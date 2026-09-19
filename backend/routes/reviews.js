const express = require('express');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Review = require('../models/Review');
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const { isValidId, LIMITS } = require('../utils/helpers');
const { ratingBreakdown, buyerTrust, ratingOf } = require('../utils/ratings');
const { findOwnedImage, imageUrl } = require('../utils/images');

const router = express.Router();

const PAGE_SIZE = 10;
const PHOTO_LIMIT = 12;
const REVIEWER_FIELDS = 'name avatarUrl storeName storeLogoUrl';

// รูปแบบรีวิวที่ส่งให้ client — trust = ความน่าเชื่อถือของผู้ซื้อ (เฉพาะรีวิวของผู้ซื้อ), products = ชื่อสินค้าที่ซื้อ
function publicReview(r, { trustMap, productMap } = {}) {
  const u = r.reviewerId && r.reviewerId.name ? r.reviewerId : null;
  const fromSeller = r.type === 'SELLER_TO_BUYER';
  return {
    id: r._id,
    type: r.type,
    rating: r.rating,
    comment: r.comment,
    images: r.images || [],
    createdAt: r.createdAt,
    reviewer: u
      ? {
          id: u._id,
          // รีวิวที่ผู้ขายเขียนถึงผู้ซื้อ → แสดงเป็นชื่อร้าน/โลโก้ร้าน
          name: fromSeller ? u.storeName || u.name : u.name,
          avatarUrl: fromSeller ? u.storeLogoUrl || u.avatarUrl || '' : u.avatarUrl || '',
          trust: !fromSeller && trustMap ? trustMap.get(String(u._id)) || null : null,
        }
      : null,
    products: (r.productIds || [])
      .slice(0, 3)
      .map((id) => productMap?.get(String(id)))
      .filter(Boolean),
  };
}

// ประกอบข้อมูลเสริม (คะแนนผู้ซื้อ + ชื่อสินค้า) แล้วแปลงรีวิวเป็น JSON สำหรับแสดงผล
async function decorate(reviews) {
  const buyerIds = reviews.filter((r) => r.type === 'BUYER_TO_SELLER' && r.reviewerId?._id).map((r) => r.reviewerId._id);
  const productIds = [...new Set(reviews.flatMap((r) => (r.productIds || []).slice(0, 3).map(String)))];
  const [trustMap, products] = await Promise.all([
    buyerTrust(buyerIds),
    productIds.length ? Product.find({ _id: { $in: productIds } }).select('name') : [],
  ]);
  const productMap = new Map(products.map((p) => [String(p._id), { id: p._id, name: p.name }]));
  return reviews.map((r) => publicReview(r, { trustMap, productMap }));
}

const oid = (id) => new mongoose.Types.ObjectId(String(id)); // $match ใน aggregate ไม่แปลง string เป็น ObjectId ให้อัตโนมัติ

// รายการรีวิวสาธารณะ (สินค้า/ร้าน): กรองตามดาว, เฉพาะที่มีรูป, แบ่งหน้า + สรุปคะแนนรวม + แกลเลอรีรูปจากผู้ซื้อจริง
async function listReviews(baseMatch, query = {}) {
  const filter = { ...baseMatch };
  const star = Number(query.rating);
  if (Number.isInteger(star) && star >= 1 && star <= 5) filter.rating = star;
  const withImages = query.withImages === '1' || query.withImages === 'true';
  if (withImages) filter.images = { $exists: true, $ne: [] };

  const page = Math.max(1, Math.min(1000, parseInt(query.page, 10) || 1));

  const [summary, total, reviews, photoRows] = await Promise.all([
    ratingBreakdown(baseMatch),
    Review.countDocuments(filter),
    Review.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .populate('reviewerId', REVIEWER_FIELDS),
    Review.find({ ...baseMatch, images: { $exists: true, $ne: [] } })
      .sort({ createdAt: -1, _id: -1 })
      .limit(PHOTO_LIMIT)
      .select('images'),
  ]);

  const photos = [];
  for (const r of photoRows) {
    for (const url of r.images) {
      if (photos.length < PHOTO_LIMIT) photos.push({ url, reviewId: r._id });
    }
  }

  return {
    rating: { avg: summary.avg, count: summary.count },
    breakdown: summary.breakdown,
    withImages: summary.withImages,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    photos,
    reviews: await decorate(reviews),
  };
}

const EMPTY_LIST = {
  rating: { avg: 0, count: 0 },
  breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  withImages: 0,
  total: 0,
  page: 1,
  pages: 1,
  photos: [],
  reviews: [],
};

// ตรวจรูปแนบรีวิว: ต้องเป็นรูปชนิด "review" ที่ผู้ใช้คนนี้อัปโหลดเอง — คืน { error } หรือ { images }
async function parseReviewImages(input, userId) {
  if (input === undefined || input === null) return { images: [] };
  if (!Array.isArray(input)) return { error: 'รูปแนบต้องเป็นรายการ' };
  const list = [...new Set(input.map((s) => String(s || '').trim()).filter(Boolean))];
  if (list.length > LIMITS.REVIEW_IMAGES) return { error: `แนบรูปได้ไม่เกิน ${LIMITS.REVIEW_IMAGES} รูป` };
  const images = [];
  for (const url of list) {
    const img = await findOwnedImage(url, userId, ['review']);
    if (!img) return { error: 'รูปที่แนบไม่ถูกต้อง กรุณาอัปโหลดรูปใหม่อีกครั้ง' };
    images.push(imageUrl(img._id));
  }
  return { images: [...new Set(images)] };
}

// เขียนรีวิวหลังคำสั่งซื้อสำเร็จ: ผู้ซื้อรีวิวผู้ขาย (แนบรูปได้) / ผู้ขายรีวิวผู้ซื้อ (ฝั่งละ 1 ครั้งต่อ Order)
router.post('/', auth, async (req, res) => {
  const { orderId, comment } = req.body || {};
  const rating = Number(req.body?.rating);

  if (!isValidId(orderId)) return res.status(400).json({ message: 'รหัสคำสั่งซื้อไม่ถูกต้อง' });
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ message: 'กรุณาให้คะแนน 1-5 ดาว' });
  }
  const text = String(comment || '').trim();
  if (text.length > LIMITS.REVIEW) {
    return res.status(400).json({ message: `รีวิวต้องไม่เกิน ${LIMITS.REVIEW} ตัวอักษร` });
  }

  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ message: 'ไม่พบคำสั่งซื้อ' });

  let type;
  let revieweeId;
  if (String(order.buyerId) === req.user.id && req.user.role === 'buyer') {
    type = 'BUYER_TO_SELLER';
    revieweeId = order.sellerId;
  } else if (String(order.sellerId) === req.user.id && req.user.role === 'seller') {
    type = 'SELLER_TO_BUYER';
    revieweeId = order.buyerId;
  } else {
    return res.status(403).json({ message: 'คุณไม่มีสิทธิ์รีวิวคำสั่งซื้อนี้' });
  }
  if (order.status !== 'COMPLETED') {
    return res.status(400).json({ message: 'รีวิวได้หลังคำสั่งซื้อสำเร็จ (ผู้ซื้อยืนยันรับสินค้าแล้ว) เท่านั้น' });
  }

  const { error, images } = await parseReviewImages(req.body?.images, req.user.id);
  if (error) return res.status(400).json({ message: error });
  if (images.length && type !== 'BUYER_TO_SELLER') {
    return res.status(400).json({ message: 'แนบรูปประกอบรีวิวได้เฉพาะผู้ซื้อ' });
  }

  try {
    const review = await Review.create({
      orderId: order._id,
      type,
      reviewerId: req.user.id,
      revieweeId,
      rating,
      comment: text,
      images,
      productIds: type === 'BUYER_TO_SELLER' ? order.items.map((i) => i.productId).filter(Boolean) : [],
    });
    res.status(201).json({ message: 'ขอบคุณสำหรับรีวิว', review });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'คุณรีวิวคำสั่งซื้อนี้ไปแล้ว' });
    throw err;
  }
});

// รีวิวของสินค้า (สาธารณะ) — ?rating=1-5 &withImages=1 &page=N
router.get('/product/:id', async (req, res) => {
  if (!isValidId(req.params.id)) return res.json(EMPTY_LIST);
  res.json(await listReviews({ productIds: oid(req.params.id), type: 'BUYER_TO_SELLER' }, req.query));
});

// รีวิวที่ผู้ซื้อเขียนถึงร้าน/ผู้ขาย (สาธารณะ — ใช้ในหน้าร้าน) — ?rating=1-5 &withImages=1 &page=N
router.get('/seller/:id', async (req, res) => {
  if (!isValidId(req.params.id)) return res.json(EMPTY_LIST);
  res.json(await listReviews({ revieweeId: oid(req.params.id), type: 'BUYER_TO_SELLER' }, req.query));
});

// รีวิวที่ "ฉันได้รับ" (ผู้ซื้อเห็นรีวิวจากผู้ขาย / ผู้ขายเห็นรีวิวจากผู้ซื้อ)
// ผู้ซื้อจะได้ trust = ระดับความน่าเชื่อถือของตัวเอง (ที่คนอื่นเห็นข้างชื่อในรีวิว)
router.get('/received', auth, async (req, res) => {
  const type = req.user.role === 'seller' ? 'BUYER_TO_SELLER' : 'SELLER_TO_BUYER';
  const reviews = await Review.find({ revieweeId: req.user.id, type })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('reviewerId', REVIEWER_FIELDS);
  const rating = await ratingOf(req.user.id, type);
  const out = { rating, reviews: await decorate(reviews) };
  if (type === 'SELLER_TO_BUYER') out.trust = (await buyerTrust([req.user.id])).get(String(req.user.id));
  res.json(out);
});

module.exports = router;
