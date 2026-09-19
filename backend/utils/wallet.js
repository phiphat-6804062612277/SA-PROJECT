const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');

const APPLIED_KEEP = 1000;

// หา/สร้าง Wallet ของผู้ใช้ (ไม่แตะยอดเงิน)
async function ensureWallet(userId) {
  const find = () =>
    Wallet.findOneAndUpdate({ userId }, { $setOnInsert: { balance: 0 } }, { new: true, upsert: true });
  try {
    return await find();
  } catch (err) {
    if (err?.code === 11000) return find(); // สร้างพร้อมกัน → รอบสองจะเจอของที่อีกฝั่งสร้างไว้
    throw err;
  }
}

/*
 * บวกยอดของ Transaction เข้า Wallet แบบ idempotent: Wallet จำ id ของรายการที่บวกแล้วไว้ (applied)
 * เรียกซ้ำกี่ครั้งก็บวกครั้งเดียว — ใช้ทั้งตอนจ่ายปกติและตอน Worker กู้คืนรายการที่ค้าง
 */
async function applyTransaction(tx) {
  const wallet = await Wallet.findOneAndUpdate(
    { _id: tx.walletId, applied: { $ne: tx._id } },
    { $inc: { balance: tx.amount }, $push: { applied: { $each: [tx._id], $slice: -APPLIED_KEEP } } },
    { new: true }
  );
  await Transaction.updateOne({ _id: tx._id }, { pendingApply: false });
  return wallet || Wallet.findById(tx.walletId);
}

/*
 * เพิ่มเงินเข้า Wallet พร้อมบันทึก Transaction
 *  1) บันทึก Transaction (pendingApply) — ถ้ามี orderId จะซ้ำประเภทเดิมของออเดอร์เดิมไม่ได้ (unique index)
 *  2) บวกยอดเข้า Wallet แบบ idempotent
 * ถ้าเซิร์ฟเวอร์ดับหลังข้อ 1 Worker (reconcilePayouts) จะบวกยอดให้เอง โดยไม่บวกซ้ำ
 */
async function credit(userId, amount, { type, description = '', orderId } = {}) {
  const wallet = await ensureWallet(userId);
  let tx;
  try {
    tx = await Transaction.create({
      walletId: wallet._id,
      type,
      amount,
      description,
      referenceOrderId: orderId,
      pendingApply: true,
    });
  } catch (err) {
    if (err?.code !== 11000 || !orderId) throw err;
    tx = await Transaction.findOne({ referenceOrderId: orderId, type }); // เคยบันทึกแล้ว (ทำซ้ำ) → ใช้รายการเดิม
    if (!tx) throw err;
  }
  return applyTransaction(tx);
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

module.exports = { credit, debitIfEnough, applyTransaction, ensureWallet };
