import { RedisClientType, createClient } from 'redis';

//PUB SUB
export class SubscriptionManager {
  private static instance: SubscriptionManager;
  private subcriberClient: RedisClientType;
  private publisherClient: RedisClientType;
  private subscribers: Map<string, string[]> = new Map();

  private constructor() {
    this.subcriberClient = createClient();
    this.subcriberClient.connect();
    this.publisherClient = createClient();
    this.publisherClient.connect();
    this.publishMessage();
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new SubscriptionManager();
    }
    return this.instance;
  }

  subscribe(market: string, id: string) {
    if (!this.subscribers.get(market)) {
      this.subscribers.set(market, []);
    }
    this.subscribers.get(market)?.push(id);
  }

  unsubcribe(market: string) {
    // this.subscribers = this.subscribers.filter((x) => x !== market);
  }

  publishMessage() {
    this.subcriberClient.subscribe('pub-sub-messages', (message: string) => {
      const parsedMessage = JSON.parse(message);
      const websocketsConnected = this.subscribers.get(
        Object.keys(parsedMessage)[0]
      );
      if (websocketsConnected) {
        websocketsConnected.map((x: any) => {
          this.publisherClient.publish(x, JSON.stringify(parsedMessage));
        });
      }
    });
  }
}
