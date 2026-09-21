// สร้างข้อมูลตัวอย่างสำหรับทดลองใช้งาน:  npm run seed
//   ผู้ซื้อ  buyer@solify.test  / 123456  (Wallet 50,000 บาท)
//   ผู้ขาย   seller@solify.test / 123456  (มีร้านและสินค้าตัวอย่าง 5 รายการ)
//   แอดมิน   admin@solify.test  / 123456  (มีข้อพิพาทตัวอย่าง 1 รายการให้ลองตัดสินที่ /admin/disputes)
//   ผู้ขายอีกร้าน green@solify.test / 123456 + ออเดอร์ที่สำเร็จแล้วพร้อมรีวิว → เห็นส่วน "ร้านค้ารีวิวดี" และ "สินค้ายอดนิยม" ในหน้าแรก
// รันซ้ำได้ ไม่สร้างข้อมูลซ้ำ
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MONGO_URI } = require('./config');
const User = require('./models/User');
const Wallet = require('./models/Wallet');
const Product = require('./models/Product');
const Order = require('./models/Order');
const Dispute = require('./models/Dispute');
const Transaction = require('./models/Transaction');
const Review = require('./models/Review');

async function upsertUser({ name, email, role, phone, address, storeName, storeDescription }) {
  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({ name, email, role, phone, address, storeName, storeDescription, password: await bcrypt.hash('123456', 10) });
  }
  // ผู้ขายที่ seed ไว้จากเวอร์ชันก่อนยังไม่มีชื่อร้าน → เติมให้
  if (role === 'seller' && !user.storeName) await User.updateOne({ _id: user._id }, { storeName, storeDescription });
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
    storeName: 'โซลาร์ไทย สโตร์',
    storeDescription: 'จำหน่ายอุปกรณ์โซลาร์เซลล์ครบวงจร แผงโซลาร์ อินเวอร์เตอร์ แบตเตอรี่ พร้อมรับประกันสินค้า',
  });
  await upsertUser({ name: 'ผู้ดูแลระบบ', email: 'admin@solify.test', role: 'admin', phone: '', address: '' });

  await Wallet.updateOne({ userId: buyer._id, balance: { $lt: 50000 } }, { balance: 50000 });

  const samples = [
    { name: 'แผงโซลาร์เซลล์ Mono 550W', price: 4990, stock: 40, description: 'แผงโซลาร์เซลล์ชนิด Monocrystalline ประสิทธิภาพสูง 550 วัตต์ รับประกัน 12 ปี' },
    { name: 'อินเวอร์เตอร์ Hybrid 5kW', price: 38900, stock: 12, description: 'Hybrid Inverter 5kW รองรับแบตเตอรี่ลิเธียม พร้อมระบบมอนิเตอร์ผ่านแอป' },
    { name: 'แบตเตอรี่ลิเธียม LiFePO4 5.12kWh', price: 45900, stock: 8, description: 'แบตเตอรี่เก็บพลังงาน LiFePO4 อายุการใช้งานมากกว่า 6,000 รอบ' },
    { name: 'สายไฟโซลาร์ PV1-F 4 ตร.มม.', price: 35, stock: 500, description: 'สายไฟ DC สำหรับงานโซลาร์เซลล์ ราคาต่อเมตร' },
    { name: 'ชุดโซล่าเซลล์ 15kW ครบชุดพร้อมติดตั้ง', price: 399000, stock: 3, description: 'ชุดระบบผลิตไฟฟ้าโซลาร์เซลล์ 15kW สำหรับบ้านและธุรกิจขนาดเล็ก ครบทั้งแผง อินเวอร์เตอร์ และอุปกรณ์ยึดจับ' },
  ];
  // สินค้าตัวอย่างเดิมชื่อ "(ขายนอกร้าน)" — ระบบถอดการขายนอกร้านออกแล้ว: เปลี่ยนชื่อสินค้าเดิม ไม่สร้างซ้ำ
  if (!(await Product.exists({ sellerId: seller._id, name: 'สายไฟโซลาร์ PV1-F 4 ตร.มม.' }))) {
    await Product.updateOne(
      { sellerId: seller._id, name: 'สายไฟโซลาร์ PV1-F 4 ตร.มม. (ขายนอกร้าน)' },
      { $set: { name: 'สายไฟโซลาร์ PV1-F 4 ตร.มม.', description: 'สายไฟ DC สำหรับงานโซลาร์เซลล์ ราคาต่อเมตร' } }
    );
  }
  for (const s of samples) {
    await Product.updateOne({ sellerId: seller._id, name: s.name }, { $setOnInsert: { ...s, sellerId: seller._id } }, { upsert: true });
  }

  // ข้อพิพาทตัวอย่าง (ออเดอร์สถานะ DISPUTED เงินถูก Freeze) ไว้ให้ Admin ลองตัดสิน — สร้างครั้งเดียว
  const demoTracking = 'SEEDDEMO0001';
  if (!(await Order.exists({ trackingNumber: demoTracking }))) {
    const product = await Product.findOne({ sellerId: seller._id, name: samples[0].name });
    const day = 24 * 60 * 60 * 1000;
    const order = await Order.create({
      buyerId: buyer._id,
      sellerId: seller._id,
      items: [{ productId: product._id, name: product.name, imageUrl: product.imageUrl, quantity: 1, price: product.price }],
      totalAmount: product.price,
      shippingName: buyer.name,
      shippingPhone: buyer.phone,
      shippingAddress: buyer.address,
      status: 'DISPUTED',
      escrowStatus: 'HELD',
      trackingNumber: demoTracking,
      shippedAt: new Date(Date.now() - 3 * day),
      disputedAt: new Date(),
      autoReleaseAt: null,
    });
    const wallet = await Wallet.findOneAndUpdate({ userId: buyer._id }, { $inc: { balance: -product.price } }, { new: true });
    await Transaction.create({
      walletId: wallet._id,
      type: 'PAYMENT',
      amount: product.price,
      description: 'ชำระค่าสินค้า (ตัวอย่างข้อพิพาท — Escrow ถือเงินไว้)',
      referenceOrderId: order._id,
    });
    const dispute = await Dispute.create({
      orderId: order._id,
      buyerId: buyer._id,
      sellerId: seller._id,
      reason: 'ได้รับพัสดุแล้วแต่แผงโซลาร์มีรอยแตกที่มุมแผง สงสัยเสียหายระหว่างขนส่ง ขอคืนเงิน',
      evidenceImages: [],
      amount: order.totalAmount,
      messages: [
        { senderId: buyer._id, senderRole: 'buyer', text: 'แนบรูปให้แล้วนะครับ แผงแตกที่มุมขวาบน' },
        { senderId: seller._id, senderRole: 'seller', text: 'แพ็กอย่างดีแล้วครับ ขอตรวจสอบกับขนส่งก่อน' },
      ],
    });
    await Order.updateOne({ _id: order._id }, { disputeId: dispute._id });
  }

  // ---- ข้อมูลตัวอย่างสำหรับส่วน "ร้านค้ารีวิวดี" / "สินค้ายอดนิยม" / รีวิว + ตราความน่าเชื่อถือ ----
  // (ออเดอร์ COMPLETED ที่ปล่อยเงินแล้ว + รีวิว — เป็นข้อมูลโชว์ยอดขาย/คะแนนเท่านั้น ไม่แตะยอด Wallet)
  const green = await upsertUser({
    name: 'กรีนพาวเวอร์',
    email: 'green@solify.test',
    role: 'seller',
    phone: '0855550000',
    address: '55 ถ.เพชรเกษม กทม. 10160',
    storeName: 'กรีนพาวเวอร์ โซลาร์',
    storeDescription: 'ชุดโซลาร์เซลล์และอุปกรณ์เสริม ราคาคุ้มค่า ส่งไวทั่วประเทศ',
  });
  const greenSamples = [
    { name: 'ชุดชาร์จเจอร์โซลาร์ 30A พร้อมสาย', price: 690, stock: 60, description: 'ชุดควบคุมการชาร์จ MPPT 30A ใช้กับแบตเตอรี่ 12/24V' },
    { name: 'ไฟถนนโซลาร์เซลล์ 200W', price: 1290, stock: 25, description: 'ไฟถนนพลังงานแสงอาทิตย์ 200W ควบคุมด้วยรีโมท กันน้ำ IP67' },
  ];
  for (const s of greenSamples) {
    await Product.updateOne({ sellerId: green._id, name: s.name }, { $setOnInsert: { ...s, sellerId: green._id } }, { upsert: true });
  }
  const byName = async (sellerId, name) => Product.findOne({ sellerId, name });
  const day = 24 * 60 * 60 * 1000;

  const demoSales = [
    { seller, name: samples[0].name, qty: 6, tracking: 'SEEDDONE0001', stars: 5, comment: 'แผงคุณภาพดีมาก แพ็กมาแน่นหนา ส่งไวครับ', mine: 5, ago: 20 },
    { seller, name: samples[0].name, qty: 2, tracking: 'SEEDDONE0002', stars: 4, comment: 'ของตรงปก ติดตั้งง่าย', mine: 5, ago: 14 },
    { seller, name: samples[1].name, qty: 1, tracking: 'SEEDDONE0003', stars: 5, comment: 'อินเวอร์เตอร์ทำงานเงียบ ประหยัดไฟจริง', mine: 4, ago: 9 },
    { seller, name: samples[2].name, qty: 1, tracking: 'SEEDDONE0004', stars: 4, comment: 'แบตเตอรี่ใช้ดี รอประเมินระยะยาวอีกนิด', mine: 5, ago: 5 },
    { seller: green, name: greenSamples[0].name, qty: 4, tracking: 'SEEDDONE0005', stars: 5, comment: 'ชาร์จเจอร์คุ้มราคา ใช้งานง่ายมาก', mine: 5, ago: 12 },
    { seller: green, name: greenSamples[1].name, qty: 3, tracking: 'SEEDDONE0006', stars: 5, comment: 'ไฟสว่างมาก รีโมทใช้ได้ดี ส่งไวสุดๆ', mine: 5, ago: 7 },
    { seller: green, name: greenSamples[1].name, qty: 1, tracking: 'SEEDDONE0007', stars: 5, comment: 'ประทับใจ แพ็กดีมาก', mine: 5, ago: 3 },
  ];
  for (const d of demoSales) {
    if (await Order.exists({ trackingNumber: d.tracking })) continue;
    const product = await byName(d.seller._id, d.name);
    if (!product) continue;
    const at = new Date(Date.now() - d.ago * day);
    const order = await Order.create({
      buyerId: buyer._id,
      sellerId: d.seller._id,
      items: [{ productId: product._id, name: product.name, imageUrl: product.imageUrl, quantity: d.qty, price: product.price }],
      totalAmount: product.price * d.qty,
      shippingName: buyer.name,
      shippingPhone: buyer.phone,
      shippingAddress: buyer.address,
      status: 'COMPLETED',
      escrowStatus: 'RELEASED',
      trackingNumber: d.tracking,
      shippedAt: at,
      completedAt: at,
      releasedBy: 'buyer',
      settled: true,
      autoReleaseAt: null,
    });
    await Review.create({ orderId: order._id, type: 'BUYER_TO_SELLER', reviewerId: buyer._id, revieweeId: d.seller._id, rating: d.stars, comment: d.comment, productIds: [product._id], createdAt: at });
    // ผู้ขายให้คะแนนผู้ซื้อกลับ → ผู้ซื้อตัวอย่างได้ตรา "ผู้ซื้อน่าเชื่อถือ" ข้างชื่อในรีวิว
    await Review.create({ orderId: order._id, type: 'SELLER_TO_BUYER', reviewerId: d.seller._id, revieweeId: buyer._id, rating: d.mine, comment: 'ผู้ซื้อชำระเงินไว ยืนยันรับสินค้าเร็ว', createdAt: at });
  }

  console.log('✅ Seed สำเร็จ');
  console.log('   ผู้ซื้อ : buyer@solify.test  / 123456');
  console.log('   ผู้ขาย : seller@solify.test / 123456');
  console.log('   แอดมิน : admin@solify.test  / 123456');
  console.log('   ผู้ขายอีกร้าน : green@solify.test / 123456');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('❌ Seed ล้มเหลว:', err.message);
  process.exit(1);
});
