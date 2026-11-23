require('dotenv').config();

const required = ['MONGO_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}. Copy .env.example to .env`);
  process.exit(1);
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI,
  accessSecret: process.env.JWT_ACCESS_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  accessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
  refreshExpiresDays: Number(process.env.JWT_REFRESH_EXPIRES_DAYS) || 7,
  clientOrigin: process.env.CLIENT_ORIGIN || '*',
  shippingFlatFee: Number(process.env.SHIPPING_FLAT_FEE ?? 40),
  freeShippingAbove: Number(process.env.FREE_SHIPPING_ABOVE ?? 500),
};
