import { createClient } from 'redis';
import { Engine } from './handlers/Engine';
import { MessageTopic } from './types/MessageTopic';

const redisClient = createClient();
redisClient.connect();

async function main() {
  const engine = Engine.getInstance();
  while (true) {
    const message = await redisClient.brPop(MessageTopic.Orders, 0);
    if (message) {
      engine.process(JSON.parse(message?.element ?? ''));
    }
  }
}

main();
