const Product = require('../models/Product');
const Category = require('../models/Category');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { bus, EVENTS } = require('../utils/events');
const { getPagination, pageMeta } = require('../utils/paginate');

const SORTS = { price_asc: { price: 1 }, price_desc: { price: -1 }, newest: { createdAt: -1 }, name: { name: 1 } };

function buildFilter(q) {
  const f = {};
  if (q.q) f.$text = { $search: q.q };
  if (q.category) f.category = q.category;
  if (q.seller) f.seller = q.seller;
  if (q.minPrice !== undefined || q.maxPrice !== undefined) {
    f.price = {};
    if (q.minPrice !== undefined) f.price.$gte = q.minPrice;
    if (q.maxPrice !== undefined) f.price.$lte = q.maxPrice;
  }
  if (q.inStock) f.stock = { $gt: 0 };
  return f;
}

async function paged(filter, query, res) {
  const pg = getPagination(query);
  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('category', 'name slug')
      .populate('seller', 'name')
      .sort(SORTS[query.sort] || SORTS.newest)
      .skip(pg.skip)
      .limit(pg.limit),
    Product.countDocuments(filter),
  ]);
  res.json({ status: 'success', meta: pageMeta(total, pg), data: { products } });
}


exports.list = catchAsync(async (req, res) => paged({ ...buildFilter(req.query), isActive: true }, req.query, res));


exports.listMine = catchAsync(async (req, res) => paged({ ...buildFilter(req.query), seller: req.user._id }, req.query, res));

exports.get = catchAsync(async (req, res) => {
  const product = await Product.findById(req.params.id).populate('category', 'name slug').populate('seller', 'name');
  if (!product || !product.isActive) throw new AppError('Product not found', 404);
  res.json({ status: 'success', data: { product } });
});

exports.create = catchAsync(async (req, res) => {
  if (!(await Category.exists({ _id: req.body.category }))) throw new AppError('Category does not exist', 400);

  let sellerId = req.user._id;
  if (req.user.role === 'admin') {
    if (!req.body.seller) throw new AppError('Admin must specify the seller for a product', 400);
    if (!(await User.exists({ _id: req.body.seller, role: 'seller' }))) throw new AppError('Seller does not exist', 400);
    sellerId = req.body.seller;
  }
  const product = await Product.create({ ...req.body, seller: sellerId });
  res.status(201).json({ status: 'success', data: { product } });
});


function assertOwnership(product, user) {
  if (user.role === 'seller' && !product.seller.equals(user._id)) {
    throw new AppError('You can only modify your own products', 403);
  }
}

exports.update = catchAsync(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError('Product not found', 404);
  assertOwnership(product, req.user);
  if (req.body.category && !(await Category.exists({ _id: req.body.category }))) {
    throw new AppError('Category does not exist', 400);
  }
  Object.assign(product, req.body);
  await product.save();
  if (req.body.stock !== undefined && product.stock <= product.lowStockThreshold) {
    bus.emit(EVENTS.STOCK_LOW, { product });
  }
  res.json({ status: 'success', data: { product } });
});

exports.remove = catchAsync(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError('Product not found', 404);
  assertOwnership(product, req.user);
  await product.deleteOne();
  res.status(204).send();
});


exports.lowStock = catchAsync(async (req, res) => {
  const filter = { $expr: { $lte: ['$stock', '$lowStockThreshold'] } };
  if (req.user.role === 'seller') filter.seller = req.user._id;
  const products = await Product.find(filter).sort({ stock: 1 }).populate('seller', 'name');
  res.json({ status: 'success', results: products.length, data: { products } });
});
