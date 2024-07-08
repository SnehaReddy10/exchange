import express, { Request, Response } from 'express';
import { createClient } from 'redis';
import { MessageTopic, Order } from '../types';
import { orderSchema } from '../schema-validations';

const app = express();
app.use(express.json());

const redisClient = createClient();
redisClient.connect();

app.post('/order', (req: Request, res: Response) => {
  const { baseAsset, price, quantity, userId, side } = req.body;

  const { success, error } = orderSchema.safeParse({
    baseAsset,
    price,
    quantity,
    userId,
    side,
  });

  if (!success) {
    return res.status(400).json({ error: error.errors });
  }

  const order: Order = { baseAsset, side, userId, price, quantity };
  redisClient.lPush(
    MessageTopic.ORDER,
    JSON.stringify({
      type: 'CREATE ORDER',
      data: order,
    })
  );

  res.send('Order placed successfully');
});

app.listen(3000, () => {
  console.log('Listening on port 3000');
});
