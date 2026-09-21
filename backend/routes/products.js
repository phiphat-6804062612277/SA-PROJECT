const express = require('express');
const Product = require('../models/Product');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { requireRole } = auth;
const { isValidId, escapeRegex, LIMITS, VISIBLE_PRODUCT } = require('../utils/helpers');
const { ratingOf, ratingOfProduct, ratingsOfProducts } = require('../utils/ratings');
const { soldCounts, topSold } = require('../utils/stats');

const SELLER_FIELDS = 'name storeName storeLogoUrl';

const router = express.Router();

// อ่านและตรวจค่าจาก body ของฟอร์มสินค้า — คืน { error } หรือ { data }
function parseProductBody(body = {}, { partial = false } = {}) {
  const data = {};
  if (!partial || body.name !== undefined) {
    const name = String(body.name || '').trim();
    if (!name) return { error: 'กรุณากรอกชื่อสินค้า' };
    if (name.length > LIMITS.PRODUCT_NAME) return { error: `ชื่อสินค้าต้องไม่เกิน ${LIMITS.PRODUCT_NAME} ตัวอักษร` };
    data.name = name;
  }
  if (!partial || body.price !== undefined) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price <= 0) return { error: 'ราคาต้องมากกว่า 0' };
    if (price > LIMITS.MAX_PRICE) {
      return { error: `ราคาต้องไม่เกิน ${LIMITS.MAX_PRICE.toLocaleString('en-US')} บาท` };
    }
    if (Math.abs(price * 100 - Math.round(price * 100)) > 1e-6) {
      return { error: 'ราคาใส่ทศนิยมได้ไม่เกิน 2 ตำแหน่ง' };
    }
    data.price = Math.round(price * 100) / 100;
  }
  if (!partial || body.stock !== undefined) {
    const stock = Number(body.stock);
    if (!Number.isInteger(stock) || stock < 0) return { error: 'จำนวนสต็อกต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป' };
    if (stock > LIMITS.MAX_STOCK) {
      return { error: `จำนวนสต็อกต้องไม่เกิน ${LIMITS.MAX_STOCK.toLocaleString('en-US')} ชิ้น` };
    }
    data.stock = stock;
  }
  if (body.description !== undefined) {
    const description = String(body.description).trim();
    if (description.length > LIMITS.PRODUCT_DESC) {
      return { error: `คำอธิบายสินค้าต้องไม่เกิน ${LIMITS.PRODUCT_DESC} ตัวอักษร` };
    }
    data.description = description;
  }
  if (body.imageUrl !== undefined) data.imageUrl = String(body.imageUrl).trim().slice(0, 1000);
  return { data };
}

// แนบข้อมูลร้าน/ผู้ขายให้สินค้า (ใช้ populate('sellerId', SELLER_FIELDS))
function withSeller(product) {
  const obj = product.toObject();
  const s = obj.sellerId;
  if (s && s._id) {
    obj.seller = { id: s._id, name: s.name, storeName: s.storeName || s.name, logoUrl: s.storeLogoUrl || '' };
    obj.sellerId = s._id;
  }
  return obj;
}

// 1. รายการสินค้าทั้งหมด (สาธารณะ) รองรับ ?q=คำค้น
router.get('/', async (req, res) => {
  const filter = { ...VISIBLE_PRODUCT };
  if (req.query.q) filter.name = new RegExp(escapeRegex(String(req.query.q).trim().slice(0, 100)), 'i');

  const products = await Product.find(filter)
    .sort({ createdAt: -1 })
    .limit(200)
    .populate('sellerId', SELLER_FIELDS);
  res.json(products.map(withSeller));
});

// สินค้ายอดนิยม: เรียงตามจำนวนที่ขายได้ (ออเดอร์ที่ชำระเงินแล้วและไม่ถูกยกเลิก/คืนเงิน) — ต้องอยู่ก่อน '/:id'
router.get('/popular', async (req, res) => {
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 8));
  const ranked = await topSold(60);
  if (!ranked.length) return res.json([]);

  const products = await Product.find({ _id: { $in: ranked.map((r) => r.productId) }, ...VISIBLE_PRODUCT }).populate(
    'sellerId',
    `${SELLER_FIELDS} isBanned storeBanned`
  );
  const byId = new Map(
    products.filter((p) => p.sellerId && !p.sellerId.isBanned && !p.sellerId.storeBanned).map((p) => [String(p._id), p])
  );

  const top = ranked.filter((r) => byId.has(String(r.productId))).slice(0, limit);
  const ratings = await ratingsOfProducts(top.map((r) => r.productId));
  res.json(
    top.map((r) => ({
      ...withSeller(byId.get(String(r.productId))),
      sold: r.sold,
      rating: ratings.get(String(r.productId)) || { avg: 0, count: 0 },
    }))
  );
});

// 2. สินค้าของร้านฉัน (ผู้ขาย) — ต้องอยู่ก่อน '/:id'
router.get('/mine', auth, requireRole('seller'), async (req, res) => {
  const products = await Product.find({ sellerId: req.user.id, isActive: { $ne: false } }).sort({
    createdAt: -1,
  });
  res.json(products);
});

// 3. รายละเอียดสินค้า (พร้อมข้อมูลร้าน + คะแนนรีวิว)
router.get('/:id', async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(404).json({ message: 'ไม่พบสินค้า' });
  const product = await Product.findOne({ _id: req.params.id, ...VISIBLE_PRODUCT }).populate(
    'sellerId',
    SELLER_FIELDS
  );
  if (!product) return res.status(404).json({ message: 'ไม่พบสินค้า' });

  const obj = withSeller(product);
  const [rating, sold, sellerRating] = await Promise.all([
    ratingOfProduct(product._id),
    soldCounts([product._id]),
    product.sellerId?._id ? ratingOf(product.sellerId._id, 'BUYER_TO_SELLER') : { avg: 0, count: 0 },
  ]);
  obj.rating = rating;
  obj.sold = sold.get(String(product._id)) || 0;
  obj.sellerRating = sellerRating; // คะแนนร้าน/ผู้ขาย (แสดงคู่กับคะแนนสินค้า)
  res.json(obj);
});

// 4. ลงขายสินค้า (เฉพาะผู้ขาย)
router.post('/', auth, requireRole('seller'), async (req, res) => {
  const { error, data } = parseProductBody(req.body);
  if (error) return res.status(400).json({ message: error });

  const me = await User.findById(req.user.id).select('storeBanned');
  if (me?.storeBanned) return res.status(403).json({ message: 'ร้านค้าของคุณถูกระงับ ไม่สามารถลงขายสินค้าได้' });

  // ผูกสินค้ากับร้านของผู้ขายที่ล็อกอินอยู่เสมอ (sellerId มาจาก token เท่านั้น — body ส่ง sellerId/storeId มาก็ไม่มีผล)
  const product = await Product.create({ ...data, sellerId: req.user.id });
  res.status(201).json({ message: 'ลงขายสินค้าสำเร็จ', product });
});

// 5. แก้ไขสินค้า (เจ้าของเท่านั้น)
router.put('/:id', auth, requireRole('seller'), async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(404).json({ message: 'ไม่พบสินค้า' });
  const { error, data } = parseProductBody(req.body, { partial: true });
  if (error) return res.status(400).json({ message: error });

  const product = await Product.findOneAndUpdate(
    { _id: req.params.id, sellerId: req.user.id, isActive: { $ne: false } },
    data,
    { new: true }
  );
  if (!product) return res.status(404).json({ message: 'ไม่พบสินค้า หรือไม่ใช่สินค้าของคุณ' });
  res.json({ message: 'บันทึกการแก้ไขแล้ว', product });
});

// 6. ลบสินค้า = ซ่อนจากหน้าร้าน (เจ้าของเท่านั้น)
router.delete('/:id', auth, requireRole('seller'), async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(404).json({ message: 'ไม่พบสินค้า' });
  const product = await Product.findOneAndUpdate(
    { _id: req.params.id, sellerId: req.user.id },
    { isActive: false },
    { new: true }
  );
  if (!product) return res.status(404).json({ message: 'ไม่พบสินค้า หรือไม่ใช่สินค้าของคุณ' });
  res.json({ message: 'ลบสินค้าเรียบร้อยแล้ว' });
});

module.exports = router;
