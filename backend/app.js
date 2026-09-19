const express = require('express');
const cors = require('cors');
const { CLIENT_ORIGINS } = require('./config');

const app = express();

app.use(cors({ origin: CLIENT_ORIGINS, credentials: true }));
app.use(express.json({ limit: '1mb' }));

app.get('/', (req, res) => res.send('Solify API is running...'));
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/orders', require('./routes/orders'));

app.use((req, res) => res.status(404).json({ message: 'ไม่พบเส้นทางที่เรียกใช้' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'ข้อมูลที่ส่งมารูปแบบไม่ถูกต้อง' });
  console.error(err);
  res.status(err.status || 500).json({
    message: err.expose ? err.message : 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง',
  });
});

module.exports = app;
