const AppError = require('../utils/AppError');
const env = require('../config/env');

exports.notFound = (req, _res, next) => next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));


exports.errorHandler = (err, _req, res, _next) => {
  let error = err;

  if (err.name === 'CastError') error = new AppError(`Invalid ${err.path}: ${err.value}`, 400);
  else if (err.name === 'ValidationError') {
    error = new AppError('Validation failed', 400, Object.values(err.errors).map((e) => ({ field: e.path, message: e.message })));
  } else if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    error = new AppError(`Duplicate value for field: ${field}`, 409);
  } else if (err.name === 'JsonWebTokenError') error = new AppError('Invalid token', 401);
  else if (err.name === 'TokenExpiredError') error = new AppError('Token expired', 401);
  else if (err.type === 'entity.parse.failed') error = new AppError('Malformed JSON body', 400);

  const statusCode = error.statusCode || 500;
  const body = {
    status: error.status || 'error',
    message: error.isOperational ? error.message : 'Something went wrong',
  };
  if (error.details) body.errors = error.details;
  if (env.nodeEnv === 'development') {
    body.stack = err.stack;
    if (!error.isOperational) body.debug = err.message;
  }
  if (statusCode >= 500) console.error('ERROR:', err);
  res.status(statusCode).json(body);
};
