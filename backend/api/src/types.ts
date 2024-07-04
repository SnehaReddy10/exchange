export type Order = {
  userId: string;
  baseAsset: 'SOL' | 'ESDC' | 'TATA';
  price: number;
  side: 'BUY' | 'ASK';
  quantity: number;
};
