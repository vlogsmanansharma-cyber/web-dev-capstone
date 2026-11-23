const Joi = require('joi');

const objectId = Joi.string().hex().length(24);
const pagination = { page: Joi.number().integer().min(1).default(1), limit: Joi.number().integer().min(1).max(100).default(10) };

exports.register = Joi.object({
  name: Joi.string().min(2).max(80).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(72).pattern(/[A-Za-z]/).pattern(/\d/).required()
    .messages({ 'string.pattern.base': 'Password must contain letters and numbers' }),
  role: Joi.string().valid('customer', 'seller').default('customer'), 
  phone: Joi.string().max(20),
});
exports.login = Joi.object({ email: Joi.string().email().required(), password: Joi.string().required() });
exports.refresh = Joi.object({ refreshToken: Joi.string().required() });

exports.updateMe = Joi.object({ name: Joi.string().min(2).max(80), phone: Joi.string().max(20) }).min(1);
exports.adminUpdateUser = Joi.object({
  role: Joi.string().valid('customer', 'seller', 'admin'),
  isActive: Joi.boolean(),
}).min(1);
exports.userQuery = Joi.object({ role: Joi.string().valid('customer', 'seller', 'admin'), ...pagination });

exports.category = Joi.object({ name: Joi.string().max(60).required(), description: Joi.string().max(300).allow('') });
exports.categoryUpdate = Joi.object({ name: Joi.string().max(60), description: Joi.string().max(300).allow('') }).min(1);

exports.productCreate = Joi.object({
  name: Joi.string().max(120).required(),
  description: Joi.string().max(2000).allow(''),
  price: Joi.number().positive().precision(2).required(),
  category: objectId.required(),
  stock: Joi.number().integer().min(0).required(),
  lowStockThreshold: Joi.number().integer().min(0),
  seller: objectId, 
});
exports.productUpdate = Joi.object({
  name: Joi.string().max(120),
  description: Joi.string().max(2000).allow(''),
  price: Joi.number().positive().precision(2),
  category: objectId,
  stock: Joi.number().integer().min(0),
  lowStockThreshold: Joi.number().integer().min(0),
  isActive: Joi.boolean(),
}).min(1);
exports.productQuery = Joi.object({
  q: Joi.string().max(100),
  category: objectId,
  seller: objectId,
  minPrice: Joi.number().min(0),
  maxPrice: Joi.number().min(0),
  inStock: Joi.boolean(),
  sort: Joi.string().valid('price_asc', 'price_desc', 'newest', 'name'),
  ...pagination,
});

exports.cartAdd = Joi.object({ productId: objectId.required(), quantity: Joi.number().integer().min(1).max(100).default(1) });
exports.cartUpdate = Joi.object({ quantity: Joi.number().integer().min(1).max(100).required() });

exports.checkout = Joi.object({
  shippingAddress: Joi.object({
    fullName: Joi.string().required(),
    phone: Joi.string().required(),
    line1: Joi.string().required(),
    line2: Joi.string().allow(''),
    city: Joi.string().required(),
    state: Joi.string().required(),
    postalCode: Joi.string().required(),
    country: Joi.string().default('India'),
  }).required(),
  paymentMethod: Joi.string().valid('COD', 'SIMULATED_CARD').required(),
});
exports.orderStatus = Joi.object({
  status: Joi.string().valid('confirmed', 'shipped', 'delivered', 'cancelled').required(),
  note: Joi.string().max(200),
});
exports.cancelOrder = Joi.object({ note: Joi.string().max(200) });
exports.orderQuery = Joi.object({
  status: Joi.string().valid('pending', 'confirmed', 'shipped', 'delivered', 'cancelled'),
  ...pagination,
});

exports.salesReportQuery = Joi.object({
  from: Joi.date().iso(),
  to: Joi.date().iso(),
  groupBy: Joi.string().valid('day', 'month').default('day'),
});
exports.bestSellingQuery = Joi.object({ limit: Joi.number().integer().min(1).max(50).default(5), from: Joi.date().iso(), to: Joi.date().iso() });
