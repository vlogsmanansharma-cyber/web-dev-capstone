const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    _id: false,
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },          
    price: { type: Number, required: true },         
    quantity: { type: Number, required: true, min: 1 },
    subtotal: { type: Number, required: true },
  }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true, required: true },
    checkoutId: { type: String, index: true },       
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: { type: [orderItemSchema], validate: (v) => v.length > 0 },
    shippingAddress: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      line1: { type: String, required: true },
      line2: String,
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, default: 'India' },
    },
    paymentMethod: { type: String, enum: ['COD', 'SIMULATED_CARD'], required: true },
    payment: {
      simulated: { type: Boolean, default: true },   
      status: { type: String, enum: ['pending', 'simulated_paid', 'simulated_refunded'], default: 'pending' },
      paidAt: Date,
    },
    subtotal: { type: Number, required: true },
    shippingFee: { type: Number, required: true },
    total: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
    },
    statusHistory: [
      {
        _id: false,
        status: String,
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        at: { type: Date, default: Date.now },
        note: String,
      },
    ],
  },
  { timestamps: true }
);

orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ seller: 1, status: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });

orderSchema.set('toJSON', { transform: (_d, r) => { delete r.__v; return r; } });

module.exports = mongoose.model('Order', orderSchema);
