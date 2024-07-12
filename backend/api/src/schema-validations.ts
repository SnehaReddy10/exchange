import { z } from 'zod';

export const orderSchema = z.object({
  market: z.enum(['SOL_INR', 'ESDC_INR', 'TATA_INR']),
  price: z.number(),
  quantity: z.number(),
  userId: z.string(),
  side: z.enum(['BUY', 'ASK']),
});
