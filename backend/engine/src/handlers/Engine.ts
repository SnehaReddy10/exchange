import { Balance } from '../types/Balance';
import { Market } from '../types/Market';
import { Order } from './Order';
import { OrderBook } from './OrderBook';
import { CREATE_ORDER, QUOTE_ASSET } from '../types/types';
import { RedisClientType, createClient } from 'redis';

export class Engine {
  private orderBooks: OrderBook[] = [];
  private balances: Map<string, Balance> = new Map();
  private static instance: Engine;
  private client: RedisClientType;
  private reverseOrderBook: any = {};

  private constructor() {
    this.populateBalances();
    this.populateOrderBooks();
    this.client = createClient();
    this.client.connect();
  }

  private populateOrderBooks() {
    this.orderBooks.push(new OrderBook('SOL', [], [], ''));
    this.orderBooks.push(new OrderBook('ESDC', [], [], ''));
    this.orderBooks.push(new OrderBook('TATA', [], [], ''));
  }

  private populateBalances() {
    this.balances.set('1', {
      [QUOTE_ASSET]: { available: 1000, locked: 0 },
      [Market.SOL]: { available: 0, locked: 0 },
    });
    this.balances.set('5', {
      [QUOTE_ASSET]: { available: 1000, locked: 0 },
      [Market.ESDC]: { available: 0, locked: 0 },
      [Market.SOL]: { available: 0, locked: 0 },
    });
    this.balances.set('2', {
      [QUOTE_ASSET]: { available: 1000, locked: 0 },
      [Market.TATA]: { available: 0, locked: 0 },
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
        let orderPlaced: { orderId: string; fills: any[] };
        const order = message.data;

        this.checkAndLockFunds(
          order.baseAsset,
          order.quantity,
          order.price,
          order.userId,
          order.side
        );
        const orderBook = this.orderBooks.filter(
          (x) => x.baseAsset == order.baseAsset
        )[0];

        if (!orderBook) {
          return 'No OrderBook Found';
        }

        if (order.side == 'BUY') {
          orderPlaced = this.fillAsksAndPlaceBid(orderBook, message);
        } else {
          orderPlaced = this.fillBidsAndPlaceAsk(orderBook, message);
        }

        var { fills } = orderPlaced;

        this.updateFunds(
          order.baseAsset,
          order.quantity,
          order.price,
          order.userId,
          fills.length ?? 0 > 1 ? fills[0].otherUserId : '',
          order.side
        );

        this.client.lPush('db-messages', JSON.stringify({ ...orderPlaced }));

        this.client.publish(
          'pub-sub-messages',
          JSON.stringify(this.reverseOrderBook)
        );
        this.client.publish(order.userId, 'ORDER PLACED');
        return orderPlaced;
    }
  };

  fillAsksAndPlaceBid(
    orderBook: OrderBook,
    message: any
  ): { orderId: string; fills: any[] } {
    let fills: any[] = [];
    let filledQty = 0;
    const orderId = randomString();
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
          orderId,
          message.data.price,
          message.data.quantity,
          message.data.userId
        )
      );
      const marketTotalOrders = this.reverseOrderBook[message.data.baseAsset];
      if (marketTotalOrders) {
        if (!marketTotalOrders[message.data.price]) {
          marketTotalOrders[message.data.price] = message.data.quantity;
        } else {
          marketTotalOrders[message.data.price] += message.data.quantity;
        }
      } else {
        this.reverseOrderBook[message.data.baseAsset] = {
          [message.data.price]: message.data.quantity,
        };
      }
    }

    return {
      orderId,
      fills,
    };
  }

  fillBidsAndPlaceAsk(
    orderBook: OrderBook,
    message: any
  ): { orderId: string; fills: any[] } {
    let fills: any[] = [];
    let filledQty = 0;
    const orderId = randomString();
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
          orderId,
          message.data.price,
          message.data.quantity,
          message.data.userId
        )
      );
    }

    return {
      orderId,
      fills,
    };
  }

  checkAndLockFunds(
    baseAsset: string,
    quantity: number,
    price: number,
    userId: string,
    side: 'ASK' | 'BUY'
  ) {
    const userBalance = this.balances.get(userId);
    console.log(userBalance, baseAsset);
    if (side == 'BUY') {
      if (
        userBalance &&
        userBalance[QUOTE_ASSET].available >= price * quantity
      ) {
        userBalance[QUOTE_ASSET].locked += quantity * price;
        return true;
      }
    } else {
      if (
        userBalance &&
        userBalance[baseAsset] &&
        userBalance[baseAsset].available >= price * quantity
      ) {
        userBalance[baseAsset].locked += quantity * price;
        return true;
      }
    }
    return false;
  }

  updateFunds(
    baseAsset: string,
    quantity: number,
    price: number,
    userId: string,
    otherUserId: string,
    side: 'ASK' | 'BUY'
  ) {
    const balance = this.balances.get(userId);
    const otherUserBalance = this.balances.get(otherUserId);
    console.log(
      'balance, otherUserBalance',
      balance,
      otherUserBalance,
      side,
      baseAsset
    );
    if (side == 'BUY') {
      if (balance && balance[QUOTE_ASSET].available >= price * quantity) {
        balance[QUOTE_ASSET].available -= quantity * price;
        balance[baseAsset].available += quantity * price;
        balance[QUOTE_ASSET].locked -= quantity * price;
        console.log(balance, quantity, price);
        if (otherUserBalance && otherUserBalance[baseAsset]) {
          otherUserBalance[baseAsset].available -= quantity * price;
          otherUserBalance[QUOTE_ASSET].available += quantity * price;
        }
        return true;
      }
    } else {
      if (
        balance &&
        balance[baseAsset] &&
        balance[baseAsset].available >= price * quantity
      ) {
        balance[baseAsset].available += quantity * price;
        balance[QUOTE_ASSET].available -= quantity * price;
        balance[baseAsset].locked -= quantity * price;
        if (otherUserBalance && otherUserBalance[baseAsset]) {
          otherUserBalance[QUOTE_ASSET].available += quantity * price;
          otherUserBalance[baseAsset].available -= quantity * price;
        }
        return true;
      }
    }
    return false;
  }
}

function randomString(): string {
  const random =
    Math.random().toString(32).substring(2, 10) +
    Math.random().toString(32).substring(2, 10);
  return random;
}
