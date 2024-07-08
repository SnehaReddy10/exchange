import { SubscriptionManager } from './utils/SubscriptionManager';
import { WebsocketManager } from './utils/WebsocketManager';

function main() {
  WebsocketManager.getInstance();
  SubscriptionManager.getInstance();
}

main();
