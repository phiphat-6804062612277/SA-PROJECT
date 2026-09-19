const express = require('express');
const User = require('../models/User');
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const { requireRole } = auth;
const { isValidId, serializeUser, LIMITS, VISIBLE_PRODUCT } = require('../utils/helpers');
const { ratingOf, topRatedSellers } = require('../utils/ratings');
const { soldCounts, soldByStore } = require('../utils/stats');
const { checkImageField, discardImage } = require('../utils/images');

const router = express.Router();

// ตั้งชื่อร้าน/คำอธิบายร้าน/โลโก้/แบนเนอร์ (ผู้ขาย) — ส่งเฉพาะฟิลด์ที่ต้องการแก้ ('' = ลบรูป)
router.put('/me', auth, requireRole('seller'), async (req, res) => {
  const { storeName, storeDescription, storeLogoUrl, storeBannerUrl } = req.body || {};
  const update = {};

  if (storeName !== undefined) {
    const n = String(storeName).trim();
    if (!n) return res.status(400).json({ message: 'กรุณากรอกชื่อร้านค้า' });
    if (n.length > LIMITS.STORE_NAME) {
      return res.status(400).json({ message: `ชื่อร้านต้องไม่เกิน ${LIMITS.STORE_NAME} ตัวอักษร` });
    }
    update.storeName = n;
  }
  if (storeDescription !== undefined) {
    const d = String(storeDescription).trim();
    if (d.length > LIMITS.STORE_DESC) {
      return res.status(400).json({ message: `คำอธิบายร้านต้องไม่เกิน ${LIMITS.STORE_DESC} ตัวอักษร` });
    }
    update.storeDescription = d;
  }

  // โลโก้/แบนเนอร์: ต้องเป็นรูปที่ผู้ขายคนนี้อัปโหลดไว้ตามชนิดนั้นจริง (หรือ '' เพื่อลบ)
  const before = await User.findById(req.user.id).select('storeLogoUrl storeBannerUrl');
  const replaced = [];
  for (const [field, kind, value] of [
    ['storeLogoUrl', 'logo', storeLogoUrl],
    ['storeBannerUrl', 'banner', storeBannerUrl],
  ]) {
    if (value === undefined) continue;
    const old = before?.[field] || '';
    const check = await checkImageField(value, req.user.id, kind, old);
    if (!check.ok) return res.status(400).json({ message: check.message });
    update[field] = check.value;
    if (check.value !== old) replaced.push(old);
  }

  const user = await User.findByIdAndUpdate(req.user.id, update, { new: true });
  // ลบรูปเดิมที่ถูกแทนที่ออกจากฐานข้อมูล (ประหยัดพื้นที่)
  for (const old of replaced) await discardImage(old, req.user.id);
  res.json({ message: 'บันทึกข้อมูลร้านค้าแล้ว', user: serializeUser(user) });
});

// ร้านค้ารีวิวดี (สาธารณะ) — จัดอันดับด้วยคะแนนถ่วงน้ำหนัก (Bayesian) เพื่อไม่ให้ร้านที่มีรีวิวเพียง 1 รายการชนะร้านที่ได้รับรีวิวดีสม่ำเสมอ
// ต้องอยู่ก่อน '/:sellerId'
router.get('/top', async (req, res) => {
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 8));
  const ranked = await topRatedSellers({ limit: 60 });
  if (!ranked.length) return res.json([]);

  const sellers = await User.find({
    _id: { $in: ranked.map((r) => r.sellerId) },
    role: 'seller',
    isBanned: { $ne: true },
    storeBanned: { $ne: true },
  }).select('name storeName storeDescription storeLogoUrl storeBannerUrl');
  const byId = new Map(sellers.map((s) => [String(s._id), s]));

  const stores = ranked.filter((r) => byId.has(String(r.sellerId))).slice(0, limit);
  const counts = await Product.aggregate([
    { $match: { sellerId: { $in: stores.map((r) => r.sellerId) }, inStore: { $ne: false }, ...VISIBLE_PRODUCT } },
    { $group: { _id: '$sellerId', n: { $sum: 1 } } },
  ]);
  const productCount = new Map(counts.map((c) => [String(c._id), c.n]));

  res.json(
    stores.map((r) => {
      const s = byId.get(String(r.sellerId));
      return {
        id: s._id,
        name: s.storeName || s.name,
        description: s.storeDescription || '',
        logoUrl: s.storeLogoUrl || '',
        bannerUrl: s.storeBannerUrl || '',
        rating: { avg: r.avg, count: r.count },
        productCount: productCount.get(String(s._id)) || 0,
      };
    })
  );
});

// หน้าร้าน (สาธารณะ): ข้อมูลร้าน + คะแนน + สินค้าที่วางไว้ "ในร้าน"
router.get('/:sellerId', async (req, res) => {
  if (!isValidId(req.params.sellerId)) return res.status(404).json({ message: 'ไม่พบร้านค้า' });

  const seller = await User.findOne({ _id: req.params.sellerId, role: 'seller' });
  if (!seller || seller.isBanned || seller.storeBanned) {
    return res.status(404).json({ message: 'ไม่พบร้านค้า หรือร้านค้านี้ถูกระงับ' });
  }

  const products = await Product.find({ sellerId: seller._id, inStore: { $ne: false }, ...VISIBLE_PRODUCT }).sort({
    createdAt: -1,
  });
  const [rating, sold, soldTotal] = await Promise.all([
    ratingOf(seller._id, 'BUYER_TO_SELLER'),
    soldCounts(products.map((p) => p._id)),
    soldByStore(seller._id),
  ]);
  res.json({
    store: {
      id: seller._id,
      name: seller.storeName || seller.name,
      description: seller.storeDescription || '',
      ownerName: seller.name,
      logoUrl: seller.storeLogoUrl || '',
      bannerUrl: seller.storeBannerUrl || '',
      since: seller.createdAt,
      soldTotal,
    },
    rating,
    products: products.map((p) => ({ ...p.toObject(), sold: sold.get(String(p._id)) || 0 })),
  });
});

module.exports = router;
