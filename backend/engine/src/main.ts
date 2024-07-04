import { createClient } from 'redis';
import { Engine } from './Engine';

const redisClient = createClient();
redisClient.connect();

async function main() {
  const engine = Engine.getInstance();
  while (true) {
    const message = await redisClient.brPop('orders', 0);
    console.log(message);
    if (message) {
      engine.process(JSON.parse(message?.element ?? ''));
    }
  }
}

main();
