import { WebSocket, WebSocketServer } from 'ws';
import { SubscriptionManager } from './SubscriptionManager';
import { RedisClientType, createClient } from 'redis';
import { SUBSCRIBE, UNSUBSCRIBE } from '../types';

//Websocket
export class WebsocketManager {
  private static instance: WebsocketManager;
  private clients: Map<string, [string, WebSocket][]> = new Map();
  private webSocketServer: WebSocketServer;
  private id: string;
  private redisClient: RedisClientType;

  private constructor() {
    this.webSocketServer = new WebSocketServer({ port: 8080 });
    this.addListeners(this.webSocketServer);
    this.id =
      Math.random().toString(36).substring(1, 6) +
      Math.random().toString(36).substring(1, 6);
    this.redisClient = createClient();
    this.redisClient.connect();
    this.subcribeToPubSub();
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new WebsocketManager();
    }
    return this.instance;
  }

  addClient(market: string, clientId: string, ws: WebSocket) {
    if (!this.clients.get(market)) {
      this.clients.set(market, [[clientId, ws]]);
    } else {
      this.clients.get(market)?.push([clientId, ws]);
    }
    if (this.clients.get(market)?.length == 1) {
      SubscriptionManager.getInstance().subscribe(market, this.id);
    }
  }

  removeClient(market: string, clientId: string) {
    let clients = this.clients.get(market);
    if (clients) {
      clients = clients.filter((x) => x[0] !== clientId);
      this.clients.set(market, clients);
    }
    if (this.clients.get(market)?.length == 0) {
      SubscriptionManager.getInstance().unsubcribe(market);
    }
  }

  addListeners(ws: WebSocketServer) {
    ws.on('connection', (ws: WebSocket) => {
      ws.on('message', (message: string) => {
        const parsedMessage = JSON.parse(message);
        console.log('Received', parsedMessage);
        if (parsedMessage.type == SUBSCRIBE) {
          this.addClient(parsedMessage.market, parsedMessage.userId, ws);
        } else if (parsedMessage.type == UNSUBSCRIBE) {
          this.removeClient(parsedMessage.market, parsedMessage.userId);
        }
      });
      console.log('Connection established');
    });
  }

  subcribeToPubSub() {
    this.redisClient.subscribe(this.id, (message: string) => {
      console.log('message from pubcub to websocket', message);
      const parsedMessage = JSON.parse(message);
      this.clients.get(parsedMessage.market)?.forEach((x) => {
        x[1].send(parsedMessage.message);
      });
    });
  }
}
