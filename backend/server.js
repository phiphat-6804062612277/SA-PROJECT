const mongoose = require('mongoose');
const { PORT, MONGO_URI, JWT_SECRET, isProd } = require('./config');

if (!JWT_SECRET) {
  console.error('❌ ต้องตั้งค่า JWT_SECRET ใน environment variables ก่อนรันบน production');
  process.exit(1);
}
if (!isProd && !process.env.JWT_SECRET) {
  console.warn('⚠️  ยังไม่ได้ตั้ง JWT_SECRET ใน .env — ใช้ค่าชั่วคราวสำหรับ dev (ห้ามใช้บน production)');
}

const app = require('./app');
const { startAutoRelease } = require('./jobs/autoRelease');
const { startImageCleanup } = require('./jobs/imageCleanup');
const { runMigrations } = require('./utils/migrations');

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB');
    await runMigrations();
    app.listen(PORT, () => console.log(`🚀 Solify API running on port ${PORT}`));
    startAutoRelease();
    startImageCleanup();
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });
