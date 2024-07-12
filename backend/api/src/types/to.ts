import { Order } from '../types';
import { CREATE_ORDER, ORDER_CANCEL, ORDER_PLACED } from './constants';
export type MessageToEngine =
  | {
      type: typeof CREATE_ORDER;
      payload: Order;
    }
  | {
      type: typeof ORDER_CANCEL;
      payload: {
        orderId: string;
        market: 'SOL_INR' | 'ESDC_INR' | 'TATA_INR';
        userId: string;
      };
    };

export type MessageFromOrderBook = {
  type: typeof ORDER_PLACED;
  payload: {
    orderId: string;
    execuedQty: number;
    fills: [
      {
        price: number;
        quantity: number;
        tradeId: number;
      }
    ];
  };
};
