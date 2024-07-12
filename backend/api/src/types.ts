export type Order = {
  userId: string;
  market: 'SOL_INR' | 'ESDC_INR' | 'TATA_INR';
  price: number;
  side: 'BUY' | 'ASK';
  quantity: number;
};

export enum MessageTopic {
  ORDER = 'order',
}
