




const EventEmitter = require('events');

const EVENTS = {
  ORDER_PLACED: 'order.placed',
  ORDER_STATUS_CHANGED: 'order.statusChanged',
  STOCK_LOW: 'stock.low',
};

class AppEvents extends EventEmitter {}
const bus = new AppEvents();

module.exports = { bus, EVENTS };
