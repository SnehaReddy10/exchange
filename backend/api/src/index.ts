import express from 'express';
import { orderRouter } from './routes/order';
import { marketRouter } from './routes/market';

const app = express();
app.use(express.json());

app.use('/order', orderRouter);
app.use('/market', marketRouter);

app.listen(3000, () => {
  console.log('Listening on port 3000');
});
