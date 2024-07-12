import { Order } from './Order';
import { QUOTE_ASSET } from '../types/types';

export class OrderBook {
  bids: Order[];
  asks: Order[];
  lastTradedId: string;
  baseAsset: 'SOL' | 'ESDC' | 'TATA';
  quoteAsset: string = QUOTE_ASSET;

  constructor(
    baseAsset: 'SOL' | 'ESDC' | 'TATA',
    bids: [],
    asks: [],
    lastTradedId: string
  ) {
    (this.asks = asks),
      (this.bids = bids),
      (this.baseAsset = baseAsset),
      (this.lastTradedId = lastTradedId);
  }

  ticker() {
    return `${this.baseAsset}_${this.quoteAsset}`;
  }
}
