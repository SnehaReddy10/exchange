export class Order {
  orderId: string;
  price: number;
  quantity: number;
  userId: string;

  constructor(
    orderId: string,
    price: number,
    quantity: number,
    userId: string
  ) {
    this.orderId = orderId;
    this.price = price;
    this.quantity = quantity;
    this.userId = userId;
  }
}
