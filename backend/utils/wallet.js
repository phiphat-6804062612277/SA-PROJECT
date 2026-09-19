const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');

// เพิ่มเงินเข้า Wallet (สร้าง Wallet ให้อัตโนมัติถ้ายังไม่มี) พร้อมบันทึก Transaction
async function credit(userId, amount, { type, description = '', orderId } = {}) {
  const wallet = await Wallet.findOneAndUpdate(
    { userId },
    { $inc: { balance: amount } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  await Transaction.create({
    walletId: wallet._id,
    type,
    amount,
    description,
    referenceOrderId: orderId,
  });
  return wallet;
}

// หักเงินแบบ atomic: สำเร็จเฉพาะเมื่อยอดคงเหลือ >= amount (กันยอดติดลบเวลากดพร้อมกัน)
// คืน wallet ใหม่ หรือ null ถ้ายอดไม่พอ  (ไม่บันทึก Transaction — ให้ผู้เรียกบันทึกเอง)
function debitIfEnough(userId, amount) {
  return Wallet.findOneAndUpdate(
    { userId, balance: { $gte: amount } },
    { $inc: { balance: -amount } },
    { new: true }
  );
}

module.exports = { credit, debitIfEnough };
