import { Balance } from './Balance';
import { Market } from './Market';
import { Order } from './Order';
import { OrderBook } from './OrderBook';
import { CREATE_ORDER, QUOTE_ASSET } from './types';

export class Engine {
  private orderBooks: OrderBook[] = [];
  private balances: Map<string, Balance> = new Map();
  private static instance: Engine;

  private constructor() {
    this.populateBalances();
    this.populateOrderBooks();
  }

  private populateOrderBooks() {
    this.orderBooks.push(new OrderBook('SOL', [], [], ''));
    this.orderBooks.push(new OrderBook('ESDC', [], [], ''));
    this.orderBooks.push(new OrderBook('TATA', [], [], ''));
  }

  private populateBalances() {
    this.balances.set('1', {
      [QUOTE_ASSET]: { available: 1000, locked: 0 },
      [Market.SOL]: { available: 1000, locked: 0 },
    });
    this.balances.set('5', {
      [QUOTE_ASSET]: { available: 1000, locked: 0 },
      [Market.ESDC]: { available: 1000, locked: 0 },
    });
    this.balances.set('2', {
      [QUOTE_ASSET]: { available: 1000, locked: 0 },
      [Market.TATA]: { available: 1000, locked: 0 },
    });
  }

  public static getInstance = () => {
    if (!this.instance) {
      this.instance = new Engine();
    }
    return this.instance;
  };

  process = (message: any) => {
    switch (message.type) {
      case CREATE_ORDER:
        let fills: any[] = [];
        const orderBook = this.orderBooks.filter(
          (x) => x.baseAsset == message.data.baseAsset
        )[0];

        if (!orderBook) {
          return 'No OrderBook Found';
        }

        if (message.data.side == 'BUY') {
          let filledQty = 0;
          const sortedAsks = orderBook.asks.sort(
            (a: Order, b: Order) => a.price - b.price
          );
          for (let i = 0; i < orderBook.asks.length; ) {
            const order = sortedAsks[i];
            if (order.price <= message.data.price) {
              let executedQty = Math.min(order.quantity, message.data.quantity);
              filledQty += executedQty;
              fills.push({
                price: message.data.price,
                quantity: executedQty,
                otherUserId: order.userId,
              });
              order.quantity -= executedQty;
              message.data.quantity -= executedQty;

              if (order.quantity == 0) {
                orderBook.asks.splice(i, 1);
              } else {
                i++;
              }
            } else {
              break;
            }
          }
          if (message.data.quantity > 0) {
            orderBook.bids.push(
              new Order(
                randomString(),
                message.data.price,
                message.data.quantity,
                message.data.userId
              )
            );
          }

          return {
            userId: message.data.userId,
            fills,
          };
        }

        if (message.data.side == 'ASK') {
          let filledQty = 0;
          for (let i = 0; i < orderBook.bids.length; ) {
            const sortedBids = orderBook.bids.sort(
              (a: Order, b: Order) => b.price - a.price
            );
            const order = sortedBids[i];
            if (order.price >= message.data.price) {
              let executedQty = Math.min(order.quantity, message.data.quantity);
              filledQty += executedQty;
              fills.push({
                price: message.data.price,
                quantity: executedQty,
                otherUserId: order.userId,
              });
              order.quantity -= executedQty;
              message.data.quantity -= executedQty;

              if (order.quantity == 0) {
                orderBook.bids.splice(i, 1);
              } else {
                i++;
              }
            } else {
              break;
            }
          }

          if (message.data.quantity > 0) {
            orderBook.asks.push(
              new Order(
                randomString(),
                message.data.price,
                message.data.quantity,
                message.data.userId
              )
            );
          }

          return {
            userId: message.data.userId,
            fills,
          };
        }
    }
  };
}

function randomString(): string {
  const random =
    Math.random().toString(32).substring(2, 10) +
    Math.random().toString(32).substring(2, 10);
  return random;
}
