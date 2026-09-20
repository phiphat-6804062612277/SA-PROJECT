const express = require('express');
const cors = require('cors');
const { CLIENT_ORIGINS } = require('./config');

const app = express();

app.use(cors({ origin: CLIENT_ORIGINS, credentials: true }));
// อัปโหลดรูป (data URL ที่ย่อแล้ว ไม่เกิน ~0.8MB ต่อรูป) ให้ body ใหญ่ได้เฉพาะเส้นทางนี้ — เส้นทางอื่นใช้ค่าปริยาย 100kb
// (ต้องประกาศก่อน express.json() ตัวทั่วไป เพราะ body-parser จะข้ามถ้า body ถูกอ่านไปแล้ว)
app.use('/api/uploads', express.json({ limit: '2mb' }));
// ไฟล์แนบในแชต (รูปที่ย่อแล้ว ≤ ~0.8MB / เอกสาร ≤ 1MB เป็น base64 ≈ 1.4MB) — เช่นเดียวกัน ให้ body ใหญ่ได้เฉพาะเส้นทางนี้
app.use('/api/chat/attachments', express.json({ limit: '2mb' }));
app.use(express.json());

app.get('/', (req, res) => res.send('Solify API is running...'));
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/stores', require('./routes/store'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/disputes', require('./routes/disputes'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/uploads', require('./routes/uploads'));
app.use('/api/images', require('./routes/images'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/admin', require('./routes/admin'));

app.use((req, res) => res.status(404).json({ message: 'ไม่พบเส้นทางที่เรียกใช้' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'ข้อมูลที่ส่งมาใหญ่เกินไป (รูปภาพ/ไฟล์ต้องไม่เกินขนาดที่กำหนด)' });
  }
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'ข้อมูลที่ส่งมารูปแบบไม่ถูกต้อง' });
  console.error(err);
  res.status(err.status || 500).json({
    message: err.expose ? err.message : 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง',
  });
});

module.exports = app;
