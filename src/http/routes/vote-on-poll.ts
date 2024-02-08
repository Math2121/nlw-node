import { z } from "zod"
import { prisma } from "../../lib/prisma"
import { FastifyInstance } from "fastify"
import { randomUUID } from "crypto"
import { redis } from "../../lib/redis"
import { voting } from "../utils/voting-pub-sub"

export async function voteOnPoll(app: FastifyInstance) {
    app.post('/polls/:pollId/votes', async (request, reply) => {
        const voteBody = z.object({
            pollOptionId: z.string().uuid()
        })

        const voteOnPollParams = z.object({
            pollId: z.string().uuid()
        })

        const { pollOptionId } = voteBody.parse(request.body)

        const { pollId } = voteOnPollParams.parse(request.params)

        let sessionId = request.cookies.session

        if (sessionId) {
            const userPreviousVote = await prisma.vote.findUnique({
                where: {
                    sessionId: sessionId,
                    pollId
                }
            })
            if (userPreviousVote && userPreviousVote.pollOptionId !== pollOptionId) {
                await prisma.vote.delete({
                    where: {
                        id: userPreviousVote.id
                    }
                })
                const votes = await redis.zincrby(pollId, -1, userPreviousVote.pollOptionId)
                voting.publish(pollId, {
                    pollOptionid: userPreviousVote.pollOptionId,
                    votes: Number(votes)
                })
                
            } else if (userPreviousVote) {
                return reply.status(400).send({ message: 'You already vote on this poll' })
            }
        }
        if (!sessionId) {
            sessionId = randomUUID()

            reply.setCookie('session', sessionId, {
                path: '/',
                maxAge: 60 * 60 * 24 * 30,
                signed: true,
                httpOnly: true
            })

        }


        await prisma.vote.create({
            data: {
                sessionId,
                pollId,
                pollOptionId

            }
        })

        const votes = await redis.zincrby(pollId, 1, pollOptionId)

        voting.publish(pollId, {
            pollOptionid: pollOptionId,
            votes: Number(votes)
        })
        return reply.status(201).send()
    })

}