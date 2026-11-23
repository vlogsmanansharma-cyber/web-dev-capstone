const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const User = require('../models/User');
const { verifyAccessToken } = require('../utils/tokens');


exports.protect = catchAsync(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) throw new AppError('Authentication required. Please log in.', 401);

  let decoded;
  try {
    decoded = verifyAccessToken(header.split(' ')[1]);
  } catch (err) {
    throw new AppError(err.name === 'TokenExpiredError' ? 'Access token expired' : 'Invalid token', 401);
  }
  const user = await User.findById(decoded.id);
  if (!user || !user.isActive) throw new AppError('User no longer exists or is deactivated', 401);
  req.user = user;
  next();
});


exports.restrictTo = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(new AppError('You do not have permission to perform this action', 403));
  }
  next();
};
