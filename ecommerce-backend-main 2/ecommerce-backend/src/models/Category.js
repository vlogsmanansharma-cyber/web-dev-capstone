const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Category name is required'], unique: true, trim: true, maxlength: 60 },
    slug: { type: String, unique: true, lowercase: true },
    description: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true }
);

categorySchema.pre('validate', function () {
  if (this.name && (this.isModified('name') || !this.slug)) {
    this.slug = this.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
});

module.exports = mongoose.model('Category', categorySchema);
