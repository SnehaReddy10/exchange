import { Balance } from '../types/Balance';
import { Market } from '../types/Market';
import { Order } from './Order';
import { OrderBook } from './OrderBook';
import { CREATE_ORDER, ORDER_CANCEL, QUOTE_ASSET } from '../types/types';
import { RedisClientType, createClient } from 'redis';
import { ReverseOrderBook } from '../types/ReverseOrderBook';

export class Engine {
  private orderBooks: OrderBook[] = [];
  private balances: Map<string, Balance> = new Map();
  private static instance: Engine;
  private client: RedisClientType;
  private reverseOrderBook: ReverseOrderBook = {};

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
        const { orderId, executedQty, fills } = this.createOrder(
          message.payload.market,
          message.payload.quantity,
          message.payload.price,
          message.payload.userId,
          message.payload.side
        );

        this.client.lPush(
          'db-messages',
          JSON.stringify({ orderId, executedQty, fills })
        );

        this.client.publish(
          'pub-sub-messages',
          JSON.stringify(this.reverseOrderBook)
        );
        this.client.publish(
          message.payload.userId,
          JSON.stringify({ payload: { orderId, executedQty, fills } })
        );
        break;
      case ORDER_CANCEL:
        const res = this.cancelOrder(
          message.payload.orderId,
          message.payload.market
        );

        if (res) {
          this.client.lPush(
            'db-messages',
            JSON.stringify({ order: message.payload.orderId })
          );
          this.client.publish(
            'pub-sub-messages',
            JSON.stringify(this.reverseOrderBook)
          );
          this.client.publish(
            message.payload.userId,
            JSON.stringify({ payload: 'ORDER CANCELLED' })
          );
        } else {
          this.client.publish(
            message.payload.userId,

            JSON.stringify({ payload: 'ORDER CANCEL FAILED' })
          );
        }
        break;
      default:
    }
  };

  createOrder(
    market: string,
    quantity: number,
    price: number,
    userId: string,
    side: 'BUY' | 'ASK'
  ) {
    let orderPlaced: { orderId: string; fills: any[]; executedQty: number };

    const orderBook = this.orderBooks.find((x) => x.ticker() == market);

    if (!orderBook) {
      throw new Error('No order found');
    }
    const baseAsset = market.split('_')[0];
    const quoteAsset = market.split('_')[1];

    this.checkAndLockFunds(baseAsset, quantity, price, userId, side);

    if (side == 'BUY') {
      orderPlaced = this.fillAsksAndPlaceBid(
        orderBook,
        baseAsset,
        quantity,
        price,
        userId,
        side
      );
    } else {
      orderPlaced = this.fillBidsAndPlaceAsk(
        orderBook,
        baseAsset,
        quantity,
        price,
        userId,
        side
      );
    }

    var { fills, orderId, executedQty } = orderPlaced;

    this.updateFunds(
      baseAsset,
      quantity,
      price,
      userId,
      fills.length ?? 0 > 1 ? fills[0].otherUserId : '',
      side
    );
    return { fills, orderId, executedQty };
  }

  fillAsksAndPlaceBid(
    orderBook: OrderBook,
    baseAsset: string,
    quantity: number,
    price: number,
    userId: string,
    side: 'BUY' | 'ASK'
  ): { orderId: string; fills: any[]; executedQty: number } {
    let fills: any[] = [];
    let filledQty = 0;
    const orderId = randomString();
    const sortedAsks = orderBook.asks.sort(
      (a: Order, b: Order) => a.price - b.price
    );
    for (let i = 0; i < orderBook.asks.length; ) {
      if (quantity > 0) {
        const order = sortedAsks[i];
        if (order.price <= price) {
          let executedQty = Math.min(order.quantity, quantity);
          filledQty += executedQty;
          fills.push({
            price: price,
            quantity: executedQty,
            otherUserId: order.userId,
          });
          order.quantity -= executedQty;
          quantity -= executedQty;

          if (order.quantity == 0) {
            orderBook.asks.splice(i, 1);
          } else {
            i++;
          }
        } else {
          break;
        }
      } else {
        break;
      }
    }
    if (quantity > 0) {
      orderBook.bids.push(new Order(orderId, price, quantity, userId));
      const marketTotalOrders = this.reverseOrderBook[baseAsset];
      if (marketTotalOrders) {
        if (!marketTotalOrders[price]) {
          marketTotalOrders[price] = quantity;
        } else {
          marketTotalOrders[price] += quantity;
        }
      } else {
        this.reverseOrderBook[baseAsset] = {
          [price]: quantity,
        };
      }
    }

    return {
      orderId,
      executedQty: filledQty,
      fills,
    };
  }

  fillBidsAndPlaceAsk(
    orderBook: OrderBook,
    baseAsset: string,
    quantity: number,
    price: number,
    userId: string,
    side: 'BUY' | 'ASK'
  ): { orderId: string; fills: any[]; executedQty: number } {
    let fills: any[] = [];
    let filledQty = 0;
    const orderId = randomString();
    for (let i = 0; i < orderBook.bids.length; ) {
      if (quantity > 0) {
        const sortedBids = orderBook.bids.sort(
          (a: Order, b: Order) => b.price - a.price
        );
        const order = sortedBids[i];
        if (order.price >= price) {
          let executedQty = Math.min(order.quantity, quantity);
          filledQty += executedQty;
          fills.push({
            price: price,
            quantity: executedQty,
            otherUserId: order.userId,
          });
          order.quantity -= executedQty;
          quantity -= executedQty;

          if (order.quantity == 0) {
            orderBook.bids.splice(i, 1);
          } else {
            i++;
          }
        } else {
          break;
        }
      } else {
        break;
      }
    }

    if (quantity > 0) {
      orderBook.asks.push(new Order(orderId, price, quantity, userId));
    }

    return {
      orderId,
      executedQty: filledQty,
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

  cancelOrder(orderId: string, market: string) {
    const order = this.orderBooks.find((x) => x.ticker() == market);
    if (order) {
      const currentMarketBook = this.reverseOrderBook[market.split('_')[0]];

      const cancelAsk = order.asks.find((x) => x.orderId == orderId);
      if (cancelAsk) {
        currentMarketBook[cancelAsk.price] -= cancelAsk.quantity;
      }

      const updatedAsks = order.asks.filter((x) => x.orderId != orderId);
      order.asks = updatedAsks;

      const cancelBid = order.bids.find((x) => x.orderId == orderId);
      if (cancelBid) {
        currentMarketBook[cancelBid.price] -= cancelBid.quantity;
      }

      const updatedBids = order.bids.filter((x) => x.orderId != orderId);
      order.bids = updatedBids;
      return true;
    } else {
      return false;
    }
  }
}

function randomString(): string {
  const random =
    Math.random().toString(32).substring(2, 10) +
    Math.random().toString(32).substring(2, 10);
  return random;
}
