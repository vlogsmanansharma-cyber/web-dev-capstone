const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const catchAsync = require('../utils/catchAsync');


const sellerScope = (user) => (user.role === 'seller' ? { seller: new mongoose.Types.ObjectId(user._id) } : {});
const dateRange = (q) => {
  const r = {};
  if (q.from) r.$gte = new Date(q.from);
  if (q.to) r.$lte = new Date(q.to);
  return Object.keys(r).length ? { createdAt: r } : {};
};




exports.salesSummary = catchAsync(async (req, res) => {
  const fmt = req.query.groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d';
  const match = { status: { $ne: 'cancelled' }, ...sellerScope(req.user), ...dateRange(req.query) };
  const rows = await Order.aggregate([
    { $match: match },
    { $group: {
        _id: { $dateToString: { format: fmt, date: '$createdAt' } },
        orders: { $sum: 1 },
        revenue: { $sum: '$total' },
        avgOrderValue: { $avg: '$total' },
    } },
    { $project: { _id: 0, period: '$_id', orders: 1, revenue: { $round: ['$revenue', 2] }, avgOrderValue: { $round: ['$avgOrderValue', 2] } } },
    { $sort: { period: 1 } },
  ]);
  const totals = rows.reduce((t, r) => ({ orders: t.orders + r.orders, revenue: +(t.revenue + r.revenue).toFixed(2) }), { orders: 0, revenue: 0 });
  res.json({ status: 'success', data: { groupBy: req.query.groupBy, totals, summary: rows } });
});




exports.bestSelling = catchAsync(async (req, res) => {
  const match = { status: { $ne: 'cancelled' }, ...sellerScope(req.user), ...dateRange(req.query) };
  const rows = await Order.aggregate([
    { $match: match },
    { $unwind: '$items' },
    { $group: {
        _id: '$items.product',
        name: { $last: '$items.name' },
        unitsSold: { $sum: '$items.quantity' },
        revenue: { $sum: '$items.subtotal' },
    } },
    { $sort: { unitsSold: -1, revenue: -1 } },
    { $limit: req.query.limit },
    { $project: { _id: 0, productId: '$_id', name: 1, unitsSold: 1, revenue: { $round: ['$revenue', 2] } } },
  ]);
  res.json({ status: 'success', data: { bestSelling: rows } });
});




exports.inventorySummary = catchAsync(async (req, res) => {
  const rows = await Product.aggregate([
    { $match: sellerScope(req.user) },
    { $group: {
        _id: '$category',
        products: { $sum: 1 },
        totalUnits: { $sum: '$stock' },
        stockValue: { $sum: { $multiply: ['$stock', '$price'] } },
        lowStockCount: { $sum: { $cond: [{ $lte: ['$stock', '$lowStockThreshold'] }, 1, 0] } },
        outOfStockCount: { $sum: { $cond: [{ $eq: ['$stock', 0] }, 1, 0] } },
    } },
    { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } },
    { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
    { $project: {
        _id: 0, categoryId: '$_id', category: { $ifNull: ['$category.name', 'Unknown'] },
        products: 1, totalUnits: 1, stockValue: { $round: ['$stockValue', 2] }, lowStockCount: 1, outOfStockCount: 1,
    } },
    { $sort: { stockValue: -1 } },
  ]);
  res.json({ status: 'success', data: { inventory: rows } });
});




exports.orderStatusBreakdown = catchAsync(async (req, res) => {
  const rows = await Order.aggregate([
    { $match: { ...sellerScope(req.user), ...dateRange(req.query) } },
    { $group: { _id: '$status', count: { $sum: 1 }, value: { $sum: '$total' } } },
    { $project: { _id: 0, status: '$_id', count: 1, value: { $round: ['$value', 2] } } },
    { $sort: { count: -1 } },
  ]);
  res.json({ status: 'success', data: { breakdown: rows } });
});
