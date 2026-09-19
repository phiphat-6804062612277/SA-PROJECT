const Order = require('../models/Order');
const Transaction = require('../models/Transaction');
const { credit, applyTransaction } = require('./wallet');
const { AUTO_RELEASE_DAYS } = require('../config');

const DAY_MS = 24 * 60 * 60 * 1000;

// เวลาครบกำหนดปล่อยเงินอัตโนมัติ = เวลาจัดส่ง + AUTO_RELEASE_DAYS
const autoReleaseTime = (shippedAt = new Date()) => new Date(new Date(shippedAt).getTime() + AUTO_RELEASE_DAYS * DAY_MS);

const RELEASE_TEXT = {
  buyer: { type: 'RECEIVE_PAYMENT', description: 'รับเงินจากการขายสินค้า (ผู้ซื้อยืนยันรับสินค้าแล้ว)' },
  auto: {
    type: 'AUTO_RELEASE',
    description: 'ปล่อยเงินอัตโนมัติ: ครบกำหนดหลังจัดส่งและผู้ซื้อไม่ได้เปิดข้อพิพาท',
  },
  admin: { type: 'RECEIVE_PAYMENT', description: 'รับเงินจากการขายสินค้า (Admin ตัดสินข้อพิพาทให้ผู้ขาย)' },
};

const refundText = (o) =>
  o.status === 'CANCELLED'
    ? o.cancelledBy === 'seller'
      ? 'คืนเงิน: ผู้ขายยกเลิกคำสั่งซื้อ'
      : 'คืนเงิน: ยกเลิกคำสั่งซื้อ'
    : 'คืนเงิน: Admin ตัดสินข้อพิพาทให้ผู้ซื้อ';

/*
 * จ่ายเงินตามสถานะ Escrow ของออเดอร์ (idempotent — เรียกซ้ำได้ ไม่จ่ายซ้ำ)
 *   escrowStatus RELEASED → เข้า Wallet ผู้ขาย   /   REFUNDED → เข้า Wallet ผู้ซื้อ
 * การ "เปลี่ยนสถานะออเดอร์" (atomic + มีเงื่อนไขสถานะเดิม) คือจุดตัดสินว่าเงินไปทางไหน
 * ส่วนการจ่ายจริงทำต่อทันที และถ้าพลาด/เซิร์ฟเวอร์ดับกลางทาง reconcilePayouts() จะทำให้จบภายหลัง
 * (unique index {orderId, type} บน Transaction + applied ใน Wallet รับประกันว่าไม่จ่ายซ้ำ)
 */
async function settleOrder(order) {
  if (order.escrowStatus === 'RELEASED') {
    const text = RELEASE_TEXT[order.releasedBy] || RELEASE_TEXT.buyer;
    await credit(order.sellerId, order.totalAmount, { ...text, orderId: order._id });
  } else if (order.escrowStatus === 'REFUNDED') {
    await credit(order.buyerId, order.totalAmount, { type: 'REFUND', description: refundText(order), orderId: order._id });
  } else {
    return false;
  }
  await Order.updateOne({ _id: order._id }, { settled: true });
  return true;
}

// พยายามจ่ายทันที ถ้าพลาดไม่ล้มทั้งคำขอ (สถานะเปลี่ยนไปแล้ว เงินจะถูกจ่ายโดย reconcilePayouts)
async function settleQuietly(order) {
  try {
    await settleOrder(order);
  } catch (err) {
    console.error(`[escrow] จ่ายเงินออเดอร์ ${order._id} ไม่สำเร็จ จะลองใหม่โดย Worker:`, err.message);
  }
}

/*
 * ปล่อยเงินจาก Escrow ให้ผู้ขาย (atomic + ทำซ้ำไม่ได้)
 * คืน order ที่อัปเดตแล้ว หรือ null ถ้าเงื่อนไขไม่ตรง (เช่น มีคนทำไปก่อนแล้ว)
 */
async function releaseToSeller(filter, { by }) {
  const order = await Order.findOneAndUpdate(
    { ...filter, escrowStatus: 'HELD' },
    { status: 'COMPLETED', escrowStatus: 'RELEASED', completedAt: new Date(), releasedBy: by, settled: false },
    { new: true }
  );
  if (!order) return null;
  await settleQuietly(order);
  return Order.findById(order._id);
}

// คืนเงินจาก Escrow ให้ผู้ซื้อหลัง Admin ตัดสินข้อพิพาท (สินค้าอยู่ระหว่าง/หลังขนส่ง จึงไม่คืนสต็อกอัตโนมัติ)
async function refundToBuyer(filter) {
  const order = await Order.findOneAndUpdate(
    { ...filter, escrowStatus: 'HELD' },
    { status: 'REFUNDED', escrowStatus: 'REFUNDED', refundedAt: new Date(), settled: false },
    { new: true }
  );
  if (!order) return null;
  await settleQuietly(order);
  return Order.findById(order._id);
}

/*
 * กู้คืนรายการเงินที่ค้างจากเซิร์ฟเวอร์ดับ/ฐานข้อมูลสะดุดกลางทาง (Worker เรียกทุกรอบ)
 *  (a) Transaction ที่บันทึกแล้วแต่ยังไม่ได้บวกเข้า Wallet  → บวกให้
 *  (b) ออเดอร์ที่เปลี่ยนสถานะเงินแล้วแต่ยังไม่มีการจ่ายจริง   → จ่ายให้
 * olderThanMs = ข้ามรายการที่เพิ่งเกิด (อาจกำลังทำอยู่ในคำขออื่น)
 */
async function reconcilePayouts({ now = new Date(), olderThanMs = 60 * 1000, batch = 500 } = {}) {
  const cutoff = new Date(now.getTime() - olderThanMs);
  let fixed = 0;

  const pendingTx = await Transaction.find({ pendingApply: true, createdAt: { $lte: cutoff } }).limit(batch);
  for (const tx of pendingTx) {
    try {
      await applyTransaction(tx);
      fixed += 1;
    } catch (err) {
      console.error(`[reconcile] บวกยอด Transaction ${tx._id} ไม่สำเร็จ:`, err.message);
    }
  }

  const orders = await Order.find({
    settled: false,
    escrowStatus: { $in: ['RELEASED', 'REFUNDED'] },
    updatedAt: { $lte: cutoff },
  }).limit(batch);
  for (const o of orders) {
    try {
      if (await settleOrder(o)) fixed += 1;
    } catch (err) {
      console.error(`[reconcile] จ่ายเงินออเดอร์ ${o._id} ไม่สำเร็จ:`, err.message);
    }
  }
  return { fixed };
}

module.exports = { releaseToSeller, refundToBuyer, settleOrder, settleQuietly, reconcilePayouts, autoReleaseTime, DAY_MS };
