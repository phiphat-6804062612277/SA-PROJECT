const express = require('express');
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const { requireRole } = auth;
const { isValidId } = require('../utils/helpers');

const router = express.Router();

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// อ่านและตรวจค่าจาก body ของฟอร์มสินค้า — คืน { error } หรือ { data }
function parseProductBody(body = {}, { partial = false } = {}) {
  const data = {};
  if (!partial || body.name !== undefined) {
    if (!String(body.name || '').trim()) return { error: 'กรุณากรอกชื่อสินค้า' };
    data.name = String(body.name).trim();
  }
  if (!partial || body.price !== undefined) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price <= 0) return { error: 'ราคาต้องมากกว่า 0' };
    data.price = price;
  }
  if (!partial || body.stock !== undefined) {
    const stock = Number(body.stock);
    if (!Number.isInteger(stock) || stock < 0) return { error: 'จำนวนสต็อกต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป' };
    data.stock = stock;
  }
  if (body.description !== undefined) data.description = String(body.description).trim();
  if (body.imageUrl !== undefined) data.imageUrl = String(body.imageUrl).trim();
  return { data };
}

// 1. รายการสินค้าทั้งหมด (สาธารณะ) รองรับ ?q=คำค้น
router.get('/', async (req, res) => {
  const filter = { isActive: { $ne: false } };
  if (req.query.q) filter.name = new RegExp(escapeRegex(String(req.query.q).trim()), 'i');

  const products = await Product.find(filter).sort({ createdAt: -1 }).limit(200);
  res.json(products);
});

// 2. สินค้าของร้านฉัน (ผู้ขาย) — ต้องอยู่ก่อน '/:id'
router.get('/mine', auth, requireRole('seller'), async (req, res) => {
  const products = await Product.find({ sellerId: req.user.id, isActive: { $ne: false } }).sort({
    createdAt: -1,
  });
  res.json(products);
});

// 3. รายละเอียดสินค้า (พร้อมชื่อร้าน)
router.get('/:id', async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(404).json({ message: 'ไม่พบสินค้า' });
  const product = await Product.findOne({ _id: req.params.id, isActive: { $ne: false } }).populate(
    'sellerId',
    'name'
  );
  if (!product) return res.status(404).json({ message: 'ไม่พบสินค้า' });

  const obj = product.toObject();
  obj.seller = obj.sellerId ? { id: obj.sellerId._id, name: obj.sellerId.name } : null;
  obj.sellerId = product.sellerId?._id || product.sellerId;
  res.json(obj);
});

// 4. ลงขายสินค้า (เฉพาะผู้ขาย)
router.post('/', auth, requireRole('seller'), async (req, res) => {
  const { error, data } = parseProductBody(req.body);
  if (error) return res.status(400).json({ message: error });

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
