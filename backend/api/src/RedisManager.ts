import { RedisClientType, createClient } from 'redis';
import { MessageFromOrderBook, MessageToEngine } from './types/to';
import { MessageTopic } from './types';

export class RedisManager {
  private static instance: RedisManager;
  private client: RedisClientType;
  private publisher: RedisClientType;

  private constructor() {
    this.client = createClient();
    this.client.connect();
    this.publisher = createClient();
    this.publisher.connect();
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new RedisManager();
    }
    return this.instance;
  }

  sendAndAwait(message: MessageToEngine) {
    return new Promise<MessageFromOrderBook>((resolve) => {
      const id = message.payload.userId;
      this.client.subscribe(id, (message: string) => {
        this.client.unsubscribe(id);
        resolve(JSON.parse(message));
      });
      this.publisher.lPush(
        MessageTopic.ORDER.toString(),
        JSON.stringify(message)
      );
    });
  }

  generateRandomId() {
    return (
      Math.random().toString(36).substring(1, 6) +
      Math.random().toString(36).substring(1, 6)
    );
  }
}
