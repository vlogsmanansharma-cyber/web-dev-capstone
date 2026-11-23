const Category = require('../models/Category');
const Product = require('../models/Product');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

exports.list = catchAsync(async (_req, res) => {
  const categories = await Category.find().sort({ name: 1 });
  res.json({ status: 'success', results: categories.length, data: { categories } });
});

exports.get = catchAsync(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new AppError('Category not found', 404);
  res.json({ status: 'success', data: { category } });
});

exports.create = catchAsync(async (req, res) => {
  const category = await Category.create(req.body);
  res.status(201).json({ status: 'success', data: { category } });
});

exports.update = catchAsync(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new AppError('Category not found', 404);
  Object.assign(category, req.body);
  await category.save(); 
  res.json({ status: 'success', data: { category } });
});

exports.remove = catchAsync(async (req, res) => {
  if (await Product.exists({ category: req.params.id })) {
    throw new AppError('Cannot delete a category that still has products', 409);
  }
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) throw new AppError('Category not found', 404);
  res.status(204).send();
});
