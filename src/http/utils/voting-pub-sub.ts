type SubscribeParams = { pollOptionid: string, votes: number }
type Subscriber = (message: SubscribeParams) => void

class VotingPubSub {
    private channels: Record<string, Subscriber[]> = {}

    subscribe(pollId: string, subscribe: Subscriber) {
        if (!this.channels[pollId]) {
            this.channels[pollId] = []
        }

        this.channels[pollId].push(subscribe)

    }

    publish(pollId: string, message: SubscribeParams) {
        if (!this.channels[pollId]) {
            return

        }
        for (const subscriber of this.channels[pollId]) {
            subscriber(message)
        }
    }
}

export const voting = new VotingPubSub()