const mongoose = require('mongoose');
const Order = require('../models/Order');

const oid = (id) => new mongoose.Types.ObjectId(String(id));

// ออเดอร์ที่นับเป็น "ขายแล้ว" — ผู้ซื้อจ่ายเงินเข้า Escrow แล้วและยังไม่ถูกยกเลิก/คืนเงิน
const SOLD_STATUSES = ['PENDING_SHIPMENT', 'SHIPPED', 'COMPLETED', 'DISPUTED'];

// จำนวนชิ้นที่ขายได้ของสินค้าหลายรายการ → Map(productId → จำนวน)
async function soldCounts(productIds) {
  const ids = [...new Set(productIds.map(String))].map(oid);
  if (!ids.length) return new Map();
  const rows = await Order.aggregate([
    { $match: { status: { $in: SOLD_STATUSES }, 'items.productId': { $in: ids } } }, // กรองก่อน $unwind เพื่อไม่ต้องกางทุกออเดอร์
    { $unwind: '$items' },
    { $match: { 'items.productId': { $in: ids } } },
    { $group: { _id: '$items.productId', sold: { $sum: '$items.quantity' } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.sold]));
}

// สินค้าขายดี → [{ productId, sold }] เรียงจากมากไปน้อย
async function topSold(limit = 30) {
  const rows = await Order.aggregate([
    { $match: { status: { $in: SOLD_STATUSES } } },
    { $unwind: '$items' },
    { $match: { 'items.productId': { $ne: null } } },
    { $group: { _id: '$items.productId', sold: { $sum: '$items.quantity' } } },
    { $sort: { sold: -1, _id: 1 } },
    { $limit: limit },
  ]);
  return rows.map((r) => ({ productId: r._id, sold: r.sold }));
}

// จำนวนชิ้นที่ร้านขายได้ทั้งหมด
async function soldByStore(sellerId) {
  const [row] = await Order.aggregate([
    { $match: { sellerId: oid(sellerId), status: { $in: SOLD_STATUSES } } },
    { $unwind: '$items' },
    { $group: { _id: null, sold: { $sum: '$items.quantity' } } },
  ]);
  return row ? row.sold : 0;
}

module.exports = { SOLD_STATUSES, soldCounts, topSold, soldByStore };
