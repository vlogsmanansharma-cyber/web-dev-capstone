



const { bus, EVENTS } = require('../utils/events');

module.exports = (io) => {
  
  bus.on(EVENTS.ORDER_PLACED, ({ order }) => {
    io.to(`user:${order.seller}`).emit('order:placed', {
      orderId: order._id, orderNumber: order.orderNumber, total: order.total,
      items: order.items.length, message: `New order ${order.orderNumber} received`,
    });
    console.log(`[event] ${EVENTS.ORDER_PLACED} ${order.orderNumber}`);
  });

  
  bus.on(EVENTS.ORDER_STATUS_CHANGED, ({ order, previousStatus, actor }) => {
    const payload = {
      orderId: order._id, orderNumber: order.orderNumber, previousStatus, status: order.status,
      message: `Order ${order.orderNumber} is now ${order.status}`,
    };
    io.to(`user:${order.customer}`).emit('order:statusChanged', payload);
    if (String(actor._id) !== String(order.seller)) io.to(`user:${order.seller}`).emit('order:statusChanged', payload);
    console.log(`[event] ${EVENTS.ORDER_STATUS_CHANGED} ${order.orderNumber}: ${previousStatus} -> ${order.status}`);
  });

  
  bus.on(EVENTS.STOCK_LOW, ({ product }) => {
    const payload = {
      productId: product._id, name: product.name, stock: product.stock, threshold: product.lowStockThreshold,
      message: `Low stock: "${product.name}" has only ${product.stock} unit(s) left`,
    };
    io.to(`user:${product.seller}`).to('role:admin').emit('stock:low', payload);
    console.log(`[event] ${EVENTS.STOCK_LOW} ${product.name} (${product.stock})`);
  });
};
