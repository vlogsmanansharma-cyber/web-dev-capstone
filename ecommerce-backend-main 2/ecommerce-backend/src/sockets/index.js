





const { Server } = require('socket.io');
const env = require('../config/env');
const User = require('../models/User');
const { verifyAccessToken } = require('../utils/tokens');

let io;

exports.initSocket = (server) => {
  io = new Server(server, { cors: { origin: env.clientOrigin } });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || (socket.handshake.headers.authorization || '').replace('Bearer ', '');
      if (!token) return next(new Error('Authentication required'));
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.id);
      if (!user || !user.isActive) return next(new Error('Invalid user'));
      socket.user = { id: String(user._id), role: user.role, name: user.name };
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.user.id}`);
    if (socket.user.role === 'admin') socket.join('role:admin');
    socket.emit('connected', { message: 'Real-time notifications active', user: socket.user });
  });

  return io;
};

exports.getIO = () => io;
