



const mongoose = require('mongoose');
const env = require('../config/env');
const User = require('../models/User');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const Order = require('../models/Order');

const addr = { fullName: 'Demo Customer', phone: '9876543210', line1: '12 MG Road', city: 'Delhi', state: 'Delhi', postalCode: '110001', country: 'India' };

(async () => {
  await mongoose.connect(env.mongoUri);
  await Promise.all([User, Category, Product, Cart, Order].map((m) => m.deleteMany({})));

  const admin = await User.create({ name: 'Admin', email: 'admin@shop.com', password: 'Admin@123', role: 'admin' });
  const s1 = await User.create({ name: 'TechWorld Seller', email: 'seller1@shop.com', password: 'Seller@123', role: 'seller' });
  const s2 = await User.create({ name: 'HomeStyle Seller', email: 'seller2@shop.com', password: 'Seller@123', role: 'seller' });
  const c1 = await User.create({ name: 'Asha Customer', email: 'customer1@shop.com', password: 'Customer@123', role: 'customer' });
  const c2 = await User.create({ name: 'Ravi Customer', email: 'customer2@shop.com', password: 'Customer@123', role: 'customer' });

  const [elec, books, home, fashion] = await Category.create([
    { name: 'Electronics', description: 'Gadgets and accessories' },
    { name: 'Books', description: 'Print and study material' },
    { name: 'Home & Kitchen', description: 'Home essentials' },
    { name: 'Fashion', description: 'Clothing and accessories' },
  ]);

  const products = await Product.create([
    { name: 'Wireless Mouse', description: 'Ergonomic 2.4GHz wireless mouse', price: 699, category: elec._id, seller: s1._id, stock: 50 },
    { name: 'Mechanical Keyboard', description: 'RGB mechanical keyboard, blue switches', price: 2999, category: elec._id, seller: s1._id, stock: 20 },
    { name: 'USB-C Charger 65W', description: 'Fast GaN charger', price: 1499, category: elec._id, seller: s1._id, stock: 4 },   
    { name: 'Bluetooth Speaker', description: 'Portable waterproof speaker', price: 1899, category: elec._id, seller: s1._id, stock: 1, lowStockThreshold: 2 }, 
    { name: 'Node.js Design Patterns', description: 'Backend engineering book', price: 899, category: books._id, seller: s1._id, stock: 30 },
    { name: 'Non-stick Frying Pan', description: '24cm induction-ready pan', price: 799, category: home._id, seller: s2._id, stock: 40 },
    { name: 'Ceramic Dinner Set', description: '18-piece dinner set', price: 2499, category: home._id, seller: s2._id, stock: 12 },
    { name: 'Cotton T-Shirt', description: 'Unisex 100% cotton t-shirt', price: 499, category: fashion._id, seller: s2._id, stock: 100 },
    { name: 'Running Shoes', description: 'Lightweight running shoes', price: 3499, category: fashion._id, seller: s2._id, stock: 25 },
    { name: 'Desk Lamp', description: 'LED desk lamp with dimmer', price: 999, category: home._id, seller: s2._id, stock: 0, isActive: true }, 
  ]);

  
  const days = (n) => new Date(Date.now() - n * 86400000);
  const mk = (n, customer, seller, items, status, createdAt) => {
    const lines = items.map(([p, q]) => ({ product: p._id, name: p.name, price: p.price, quantity: q, subtotal: p.price * q }));
    const subtotal = lines.reduce((s, l) => s + l.subtotal, 0);
    const shippingFee = subtotal >= env.freeShippingAbove ? 0 : env.shippingFlatFee;
    return {
      orderNumber: `ORD-SEED-${n}`, customer: customer._id, seller: seller._id, items: lines, shippingAddress: addr,
      paymentMethod: 'SIMULATED_CARD', payment: { simulated: true, status: status === 'cancelled' ? 'simulated_refunded' : 'simulated_paid', paidAt: createdAt },
      subtotal, shippingFee, total: subtotal + shippingFee, status, createdAt, updatedAt: createdAt,
      statusHistory: [{ status, changedBy: admin._id, note: 'Seeded', at: createdAt }],
    };
  };
  const [mouse, kb, , , book, pan, dinner, tee, shoes] = products;
  await Order.create([
    mk(1, c1, s1, [[mouse, 2], [kb, 1]], 'delivered', days(20)),
    mk(2, c2, s1, [[book, 3]], 'delivered', days(12)),
    mk(3, c1, s2, [[pan, 1], [tee, 4]], 'delivered', days(9)),
    mk(4, c2, s2, [[shoes, 1]], 'shipped', days(5)),
    mk(5, c1, s2, [[dinner, 1]], 'confirmed', days(2)),
    mk(6, c2, s1, [[mouse, 1]], 'cancelled', days(1)),
  ]);

  console.log('Seed complete. Accounts:');
  console.table([
    { role: 'admin', email: 'admin@shop.com', password: 'Admin@123' },
    { role: 'seller', email: 'seller1@shop.com', password: 'Seller@123' },
    { role: 'seller', email: 'seller2@shop.com', password: 'Seller@123' },
    { role: 'customer', email: 'customer1@shop.com', password: 'Customer@123' },
    { role: 'customer', email: 'customer2@shop.com', password: 'Customer@123' },
  ]);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
