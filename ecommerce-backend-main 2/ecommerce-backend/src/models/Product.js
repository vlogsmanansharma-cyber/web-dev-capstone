const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Product name is required'], trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    price: { type: Number, required: [true, 'Price is required'], min: [0.01, 'Price must be positive'] },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    stock: {
      type: Number,
      required: true,
      min: [0, 'Stock cannot be negative'],
      validate: { validator: Number.isInteger, message: 'Stock must be an integer' },
    },
    lowStockThreshold: { type: Number, default: 5, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);


productSchema.index({ name: 'text', description: 'text' });   
productSchema.index({ category: 1, price: 1 });               
productSchema.index({ seller: 1, createdAt: -1 });            
productSchema.index({ stock: 1 });                            

productSchema.virtual('isLowStock').get(function () {
  return this.stock <= this.lowStockThreshold;
});
productSchema.set('toJSON', { virtuals: true, transform: (_d, r) => { delete r.__v; delete r.id; return r; } });

module.exports = mongoose.model('Product', productSchema);
