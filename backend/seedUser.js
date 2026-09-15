const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User'); // ปรับ Path ตามโครงสร้างโปรเจกต์ของคุณ

// เชื่อมต่อ MongoDB (ใส่ Mongo URI ของคุณ)
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/solify');

async function createTestUser() {
  const hashedPassword = await bcrypt.hash('123456', 10);
  
  const user = new User({
    name: 'Test User',
    email: 'test@gmail.com',
    password: hashedPassword,
    role: 'buyer'
  });

  await user.save();
  console.log('✅ สร้างผู้ใช้ทดสอบสำเร็จ: test@gmail.com / รหัสผ่าน: 123456');
  process.exit();
}

createTestUser();