import { Router, Request, Response } from 'express';
import { orderSchema } from '../schema-validations';
import { RedisManager } from '../RedisManager';
import { CREATE_ORDER, ORDER_CANCEL } from '../types/constants';
import { Order } from '../types';

export const orderRouter = Router();

orderRouter.post('/order', async (req: Request, res: Response) => {
  const { market, price, quantity, userId, side } = req.body;

  const { success, error } = orderSchema.safeParse({
    market,
    price,
    quantity,
    userId,
    side,
  });

  if (!success) {
    return res.status(400).json({ error: error.errors });
  }

  const order: Order = { market, side, userId, price, quantity };

  console.log('create order');
  const response = await RedisManager.getInstance().sendAndAwait({
    type: CREATE_ORDER,
    payload: order,
  });

  res.json(response.payload);
});

orderRouter.delete('/', async (req: Request, res: Response) => {
  const { market, orderId, userId } = req.body;
  const response = await RedisManager.getInstance().sendAndAwait({
    type: ORDER_CANCEL,
    payload: {
      orderId,
      market,
      userId,
    },
  });
  return res.json(response.payload);
});
