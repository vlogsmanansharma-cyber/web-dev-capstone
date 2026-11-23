const crypto = require('crypto');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Order = require('../models/Order');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const env = require('../config/env');
const { bus, EVENTS } = require('../utils/events');
const { round2 } = require('../utils/money');
const { getPagination, pageMeta } = require('../utils/paginate');


const TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

const rollbackStock = async (reserved) => {
  if (!reserved.length) return;
  await Product.bulkWrite(
    reserved.map((r) => ({ updateOne: { filter: { _id: r.product }, update: { $inc: { stock: r.quantity } } } }))
  );
};

const newOrderNumber = () => `ORD-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;











exports.checkout = catchAsync(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart || cart.items.length === 0) throw new AppError('Your cart is empty', 400);

  const reserved = [];
  const lowStock = [];
  const bySeller = {};
  let orders;

  try {
    for (const item of cart.items) {
      const product = await Product.findOneAndUpdate(
        { _id: item.product, isActive: true, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } },
        { new: true }
      );
      if (!product) {
        const p = await Product.findById(item.product).select('name');
        throw new AppError(
          p ? `"${p.name}" is out of stock or has insufficient quantity` : 'A product in your cart is no longer available',
          409
        );
      }
      reserved.push({ product: product._id, quantity: item.quantity });
      if (product.stock <= product.lowStockThreshold) lowStock.push(product);

      const key = String(product.seller);
      (bySeller[key] = bySeller[key] || []).push({
        product: product._id,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        subtotal: round2(product.price * item.quantity),
      });
    }

    const checkoutId = crypto.randomUUID();
    const isPaid = req.body.paymentMethod === 'SIMULATED_CARD';
    const docs = Object.entries(bySeller).map(([seller, items]) => {
      const subtotal = round2(items.reduce((s, i) => s + i.subtotal, 0));
      const shippingFee = subtotal >= env.freeShippingAbove ? 0 : env.shippingFlatFee;
      return {
        orderNumber: newOrderNumber(),
        checkoutId,
        customer: req.user._id,
        seller,
        items,
        shippingAddress: req.body.shippingAddress,
        paymentMethod: req.body.paymentMethod,
        payment: { simulated: true, status: isPaid ? 'simulated_paid' : 'pending', paidAt: isPaid ? new Date() : undefined },
        subtotal,
        shippingFee,
        total: round2(subtotal + shippingFee),
        statusHistory: [{ status: 'pending', changedBy: req.user._id, note: 'Order placed' }],
      };
    });
    orders = await Order.create(docs);
  } catch (err) {
    await rollbackStock(reserved);
    throw err;
  }

  cart.items = [];
  await cart.save();

  orders.forEach((order) => bus.emit(EVENTS.ORDER_PLACED, { order }));
  lowStock.forEach((product) => bus.emit(EVENTS.STOCK_LOW, { product }));

  res.status(201).json({
    status: 'success',
    message: 'Order placed. NOTE: payment is simulated - no real transaction occurred.',
    data: { orders },
  });
});


const scopeFilter = (user) => (user.role === 'customer' ? { customer: user._id } : user.role === 'seller' ? { seller: user._id } : {});

exports.list = catchAsync(async (req, res) => {
  const pg = getPagination(req.query);
  const filter = scopeFilter(req.user);
  if (req.query.status) filter.status = req.query.status;
  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(pg.skip).limit(pg.limit),
    Order.countDocuments(filter),
  ]);
  res.json({ status: 'success', meta: pageMeta(total, pg), data: { orders } });
});

async function loadAccessible(req) {
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError('Order not found', 404);
  const { role, _id } = req.user;
  const allowed =
    role === 'admin' || (role === 'customer' && order.customer.equals(_id)) || (role === 'seller' && order.seller.equals(_id));
  if (!allowed) throw new AppError('You do not have access to this order', 403);
  return order;
}

exports.get = catchAsync(async (req, res) => {
  const order = await loadAccessible(req);
  await order.populate([{ path: 'customer', select: 'name email' }, { path: 'seller', select: 'name' }]);
  res.json({ status: 'success', data: { order } });
});


async function transition(order, newStatus, actor, note) {
  if (!TRANSITIONS[order.status].includes(newStatus)) {
    throw new AppError(`Invalid status transition: ${order.status} -> ${newStatus}`, 409);
  }
  const set = { status: newStatus };
  if (newStatus === 'delivered' && order.payment.status === 'pending') {
    set['payment.status'] = 'simulated_paid';
    set['payment.paidAt'] = new Date();
  }
  if (newStatus === 'cancelled' && order.payment.status === 'simulated_paid') set['payment.status'] = 'simulated_refunded';

  
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: order.status },
    { $set: set, $push: { statusHistory: { status: newStatus, changedBy: actor._id, note } } },
    { new: true }
  );
  if (!updated) throw new AppError('Order was modified concurrently. Please retry.', 409);

  if (newStatus === 'cancelled') {
    await rollbackStock(order.items.map((i) => ({ product: i.product, quantity: i.quantity }))); 
  }
  bus.emit(EVENTS.ORDER_STATUS_CHANGED, { order: updated, previousStatus: order.status, actor });
  return updated;
}

exports.updateStatus = catchAsync(async (req, res) => {
  const order = await loadAccessible(req); 
  const updated = await transition(order, req.body.status, req.user, req.body.note);
  res.json({ status: 'success', data: { order: updated } });
});

exports.cancel = catchAsync(async (req, res) => {
  const order = await loadAccessible(req); 
  const updated = await transition(order, 'cancelled', req.user, req.body.note || 'Cancelled by user');
  res.json({ status: 'success', message: 'Order cancelled and stock restored', data: { order: updated } });
});
