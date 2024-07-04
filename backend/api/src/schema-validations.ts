import { z } from 'zod';

export const orderSchema = z.object({
  baseAsset: z.enum(['SOL', 'ESDC', 'TATA']),
  price: z.number(),
  quantity: z.number(),
  userId: z.string(),
  side: z.enum(['BUY', 'ASK']),
});
