const mongoose = require('mongoose');
const Review = require('../models/Review');

const oid = (id) => new mongoose.Types.ObjectId(String(id));
const round1 = (n) => Math.round(n * 10) / 10;

// คะแนนเฉลี่ยของผู้ใช้คนเดียว → { avg, count }
async function ratingOf(revieweeId, type) {
  const [row] = await Review.aggregate([
    { $match: { revieweeId: oid(revieweeId), type } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  return { avg: row ? round1(row.avg) : 0, count: row ? row.count : 0 };
}

// คะแนนเฉลี่ยของสินค้า (จากรีวิวของผู้ซื้อที่ซื้อสินค้านี้)
async function ratingOfProduct(productId) {
  const [row] = await Review.aggregate([
    { $match: { productIds: oid(productId), type: 'BUYER_TO_SELLER' } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  return { avg: row ? round1(row.avg) : 0, count: row ? row.count : 0 };
}

// คะแนนเฉลี่ยของผู้ใช้หลายคนพร้อมกัน → Map(userId → { avg, count })
async function ratingsOfMany(userIds, type) {
  const ids = [...new Set(userIds.map(String))].map(oid);
  const rows = ids.length
    ? await Review.aggregate([
        { $match: { revieweeId: { $in: ids }, type } },
        { $group: { _id: '$revieweeId', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
      ])
    : [];
  return new Map(rows.map((r) => [String(r._id), { avg: round1(r.avg), count: r.count }]));
}

// คะแนนเฉลี่ยของสินค้าหลายรายการพร้อมกัน → Map(productId → { avg, count })
async function ratingsOfProducts(productIds) {
  const ids = [...new Set(productIds.map(String))].map(oid);
  const rows = ids.length
    ? await Review.aggregate([
        { $match: { productIds: { $in: ids }, type: 'BUYER_TO_SELLER' } },
        { $unwind: '$productIds' },
        { $match: { productIds: { $in: ids } } },
        { $group: { _id: '$productIds', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
      ])
    : [];
  return new Map(rows.map((r) => [String(r._id), { avg: round1(r.avg), count: r.count }]));
}

// สรุปจำนวนรีวิวแยกตามดาว → { breakdown: {1..5}, count, avg, withImages }
// match = เงื่อนไข Review (เช่น { productIds: id, type: 'BUYER_TO_SELLER' })
async function ratingBreakdown(match) {
  const rows = await Review.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$rating',
        count: { $sum: 1 },
        withImages: { $sum: { $cond: [{ $gt: [{ $size: { $ifNull: ['$images', []] } }, 0] }, 1, 0] } },
      },
    },
  ]);
  const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let count = 0;
  let sum = 0;
  let withImages = 0;
  for (const r of rows) {
    if (breakdown[r._id] === undefined) continue;
    breakdown[r._id] = r.count;
    count += r.count;
    sum += r._id * r.count;
    withImages += r.withImages;
  }
  return { breakdown, count, avg: count ? round1(sum / count) : 0, withImages };
}

// ระดับความน่าเชื่อถือของ "ผู้ซื้อ" จากคะแนนที่ผู้ขายให้ (SELLER_TO_BUYER)
//   new     = ยังไม่มีประวัติ, trusted = เฉลี่ย ≥ 4.5 และมีอย่างน้อย 3 รีวิว, good = เฉลี่ย ≥ 4,
//   normal  = เฉลี่ย ≥ 3, caution = ต่ำกว่า 3 (และมีอย่างน้อย 3 รีวิว — น้อยกว่านั้นยังตัดสินไม่ได้ ให้ถือว่า normal)
const TRUST_LABELS = {
  new: 'ผู้ซื้อใหม่',
  trusted: 'ผู้ซื้อน่าเชื่อถือ',
  good: 'ผู้ซื้อคุณภาพ',
  normal: 'ผู้ซื้อทั่วไป',
  caution: 'ควรระมัดระวัง',
};
function trustLevel(avg, count) {
  if (!count) return 'new';
  if (avg >= 4.5 && count >= 3) return 'trusted';
  if (avg >= 4) return 'good';
  if (avg >= 3 || count < 3) return 'normal';
  return 'caution';
}
// avg = ค่าเฉลี่ยดิบ (ยังไม่ปัดเศษ) — ระดับคำนวณจากค่าดิบ ส่วนค่าที่แสดงปัดเป็น 1 ตำแหน่ง (กัน 4.46 ถูกปัดเป็น 4.5 แล้วได้ตราสูงเกินจริง)
const trustOf = (avg, count) => {
  const level = trustLevel(avg, count);
  return { avg: round1(avg), count, level, label: TRUST_LABELS[level] };
};

// ความน่าเชื่อถือของผู้ซื้อหลายคน → Map(buyerId → { avg, count, level, label })
async function buyerTrust(buyerIds) {
  const ids = [...new Set(buyerIds.map(String))];
  const rows = ids.length
    ? await Review.aggregate([
        { $match: { revieweeId: { $in: ids.map(oid) }, type: 'SELLER_TO_BUYER' } },
        { $group: { _id: '$revieweeId', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
      ])
    : [];
  const raw = new Map(rows.map((r) => [String(r._id), r]));
  const out = new Map();
  for (const id of ids) {
    const r = raw.get(id);
    out.set(id, trustOf(r ? r.avg : 0, r ? r.count : 0));
  }
  return out;
}

// คะแนนถ่วงน้ำหนักแบบ Bayesian: ร้านที่มีรีวิวน้อยมากจะไม่ขึ้นอันดับต้นเพียงเพราะได้ 5 ดาวครั้งเดียว
//   score = (v/(v+m))·R + (m/(v+m))·C   เมื่อ v = จำนวนรีวิวของร้าน, R = ค่าเฉลี่ยของร้าน, m = น้ำหนักค่าตั้งต้น, C = ค่าเฉลี่ยทั้งระบบ
function bayesianScore(avg, count, globalAvg, m = 3) {
  return (count / (count + m)) * avg + (m / (count + m)) * globalAvg;
}

// ร้านที่ได้รับรีวิวสูงสุด → [{ sellerId, avg, count, score }] เรียงจากดีที่สุด
async function topRatedSellers({ limit = 10 } = {}) {
  const rows = await Review.aggregate([
    { $match: { type: 'BUYER_TO_SELLER' } },
    { $group: { _id: '$revieweeId', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  if (!rows.length) return [];
  const total = rows.reduce((s, r) => s + r.count, 0);
  const globalAvg = rows.reduce((s, r) => s + r.avg * r.count, 0) / total;
  return rows
    .map((r) => ({
      sellerId: r._id,
      avg: round1(r.avg),
      count: r.count,
      score: bayesianScore(r.avg, r.count, globalAvg),
    }))
    .sort((a, b) => b.score - a.score || b.count - a.count)
    .slice(0, limit);
}

module.exports = {
  ratingOf,
  ratingOfProduct,
  ratingsOfMany,
  ratingsOfProducts,
  ratingBreakdown,
  buyerTrust,
  trustOf,
  trustLevel,
  bayesianScore,
  topRatedSellers,
};
