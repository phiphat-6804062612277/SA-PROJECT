// สร้างข้อมูลตัวอย่างสำหรับทดลองใช้งาน:  npm run seed
//   ผู้ซื้อ  buyer@solify.test  / 123456  (Wallet 50,000 บาท)
//   ผู้ขาย   seller@solify.test / 123456  (มีสินค้าตัวอย่าง 4 รายการ)
// รันซ้ำได้ ไม่สร้างข้อมูลซ้ำ
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MONGO_URI } = require('./config');
const User = require('./models/User');
const Wallet = require('./models/Wallet');
const Product = require('./models/Product');

async function upsertUser({ name, email, role, phone, address }) {
  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({ name, email, role, phone, address, password: await bcrypt.hash('123456', 10) });
  }
  await Wallet.findOneAndUpdate({ userId: user._id }, { $setOnInsert: { balance: 0 } }, { upsert: true });
  return user;
}

async function main() {
  await mongoose.connect(MONGO_URI);

  const buyer = await upsertUser({
    name: 'สมชาย สายลม',
    email: 'buyer@solify.test',
    role: 'buyer',
    phone: '0812345678',
    address: '123/45 ถนนวิภาวดีรังสิต แขวงลาดยาว เขตจตุจักร กทม. 10900',
  });
  const seller = await upsertUser({
    name: 'ร้านโซลาร์ไทย',
    email: 'seller@solify.test',
    role: 'seller',
    phone: '0898765432',
    address: '99 หมู่ 3 ต.บางพลี อ.บางพลี จ.สมุทรปราการ 10540',
  });

  await Wallet.updateOne({ userId: buyer._id, balance: { $lt: 50000 } }, { balance: 50000 });

  const samples = [
    { name: 'แผงโซลาร์เซลล์ Mono 550W', price: 4990, stock: 40, description: 'แผงโซลาร์เซลล์ชนิด Monocrystalline ประสิทธิภาพสูง 550 วัตต์ รับประกัน 12 ปี' },
    { name: 'อินเวอร์เตอร์ Hybrid 5kW', price: 38900, stock: 12, description: 'Hybrid Inverter 5kW รองรับแบตเตอรี่ลิเธียม พร้อมระบบมอนิเตอร์ผ่านแอป' },
    { name: 'แบตเตอรี่ลิเธียม LiFePO4 5.12kWh', price: 45900, stock: 8, description: 'แบตเตอรี่เก็บพลังงาน LiFePO4 อายุการใช้งานมากกว่า 6,000 รอบ' },
    { name: 'ชุดโซล่าเซลล์ 15kW ครบชุดพร้อมติดตั้ง', price: 399000, stock: 3, description: 'ชุดระบบผลิตไฟฟ้าโซลาร์เซลล์ 15kW สำหรับบ้านและธุรกิจขนาดเล็ก ครบทั้งแผง อินเวอร์เตอร์ และอุปกรณ์ยึดจับ' },
  ];
  for (const s of samples) {
    await Product.updateOne({ sellerId: seller._id, name: s.name }, { $setOnInsert: { ...s, sellerId: seller._id } }, { upsert: true });
  }

  console.log('✅ Seed สำเร็จ');
  console.log('   ผู้ซื้อ : buyer@solify.test  / 123456');
  console.log('   ผู้ขาย : seller@solify.test / 123456');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('❌ Seed ล้มเหลว:', err.message);
  process.exit(1);
});
