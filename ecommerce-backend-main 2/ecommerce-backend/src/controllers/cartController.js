const Cart = require('../models/Cart');
const Product = require('../models/Product');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { round2 } = require('../utils/money');


async function buildView(userId) {
  const cart = await Cart.findOne({ user: userId }).populate('items.product', 'name price stock isActive seller');
  const items = [];
  let subtotal = 0;
  for (const it of cart ? cart.items : []) {
    const p = it.product;
    if (!p) continue; 
    const available = p.isActive && p.stock >= it.quantity;
    const lineTotal = round2(p.price * it.quantity);
    if (available) subtotal += lineTotal;
    items.push({
      product: p._id, name: p.name, price: p.price, quantity: it.quantity,
      lineTotal, availableStock: p.stock, available,
    });
  }
  return { items, itemCount: items.length, subtotal: round2(subtotal) };
}

async function getOrCreate(userId) {
  return (await Cart.findOne({ user: userId })) || (await Cart.create({ user: userId, items: [] }));
}

async function loadProduct(id) {
  const p = await Product.findById(id);
  if (!p || !p.isActive) throw new AppError('Product not found or unavailable', 404);
  return p;
}

exports.getCart = catchAsync(async (req, res) => {
  res.json({ status: 'success', data: { cart: await buildView(req.user._id) } });
});

exports.addItem = catchAsync(async (req, res) => {
  const { productId, quantity } = req.body;
  const product = await loadProduct(productId);
  const cart = await getOrCreate(req.user._id);
  const existing = cart.items.find((i) => i.product.equals(product._id));
  const newQty = (existing ? existing.quantity : 0) + quantity;
  if (newQty > product.stock) throw new AppError(`Only ${product.stock} unit(s) of "${product.name}" in stock`, 409);
  if (newQty > 100) throw new AppError('Maximum 100 units per product', 400);
  if (existing) existing.quantity = newQty;
  else cart.items.push({ product: product._id, quantity });
  await cart.save();
  res.status(201).json({ status: 'success', data: { cart: await buildView(req.user._id) } });
});

exports.updateItem = catchAsync(async (req, res) => {
  const product = await loadProduct(req.params.productId);
  const cart = await getOrCreate(req.user._id);
  const item = cart.items.find((i) => i.product.equals(product._id));
  if (!item) throw new AppError('Item not in cart', 404);
  if (req.body.quantity > product.stock) throw new AppError(`Only ${product.stock} unit(s) in stock`, 409);
  item.quantity = req.body.quantity;
  await cart.save();
  res.json({ status: 'success', data: { cart: await buildView(req.user._id) } });
});

exports.removeItem = catchAsync(async (req, res) => {
  const cart = await getOrCreate(req.user._id);
  const before = cart.items.length;
  cart.items = cart.items.filter((i) => String(i.product) !== req.params.productId);
  if (cart.items.length === before) throw new AppError('Item not in cart', 404);
  await cart.save();
  res.json({ status: 'success', data: { cart: await buildView(req.user._id) } });
});

exports.clear = catchAsync(async (req, res) => {
  await Cart.updateOne({ user: req.user._id }, { $set: { items: [] } });
  res.status(204).send();
});
