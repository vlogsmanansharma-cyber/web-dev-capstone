const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');

exports.signAccessToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, env.accessSecret, { expiresIn: env.accessExpires });

exports.signRefreshToken = (user) =>
  jwt.sign({ id: user._id, jti: crypto.randomUUID() }, env.refreshSecret, {
    expiresIn: `${env.refreshExpiresDays}d`,
  });

exports.verifyAccessToken = (t) => jwt.verify(t, env.accessSecret);
exports.verifyRefreshToken = (t) => jwt.verify(t, env.refreshSecret);


exports.hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');
