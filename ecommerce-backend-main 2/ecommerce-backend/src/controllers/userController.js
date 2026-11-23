const User = require('../models/User');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { getPagination, pageMeta } = require('../utils/paginate');

exports.getMe = (req, res) => res.json({ status: 'success', data: { user: req.user } });

exports.updateMe = catchAsync(async (req, res) => {
  Object.assign(req.user, req.body); 
  await req.user.save();
  res.json({ status: 'success', data: { user: req.user } });
});


exports.listUsers = catchAsync(async (req, res) => {
  const pg = getPagination(req.query);
  const filter = req.query.role ? { role: req.query.role } : {};
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(pg.skip).limit(pg.limit),
    User.countDocuments(filter),
  ]);
  res.json({ status: 'success', meta: pageMeta(total, pg), data: { users } });
});

exports.getUser = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404);
  res.json({ status: 'success', data: { user } });
});

exports.updateUser = catchAsync(async (req, res) => {
  if (req.params.id === String(req.user._id) && (req.body.role || req.body.isActive === false)) {
    throw new AppError('Admins cannot change their own role or deactivate themselves', 400);
  }
  const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!user) throw new AppError('User not found', 404);
  res.json({ status: 'success', data: { user } });
});

exports.deleteUser = catchAsync(async (req, res) => {
  if (req.params.id === String(req.user._id)) throw new AppError('You cannot delete your own account', 400);
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) throw new AppError('User not found', 404);
  res.status(204).send();
});
