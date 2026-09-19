require('dotenv').config({ quiet: true });

const isProd = process.env.NODE_ENV === 'production';

// JWT_SECRET ต้องตั้งเองบน production (dev ใช้ค่า fallback ได้เพื่อความสะดวก)
const JWT_SECRET = process.env.JWT_SECRET || (isProd ? '' : 'dev-only-secret-change-me');

module.exports = {
  isProd,
  JWT_SECRET,
  PORT: process.env.PORT || 5000,
  MONGO_URI: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/solify',
  // เว็บ frontend ที่อนุญาตให้เรียก API (คั่นด้วย , ได้หลายโดเมน)
  CLIENT_ORIGINS: (process.env.CLIENT_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean),
};
