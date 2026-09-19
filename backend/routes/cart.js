const express = require('express');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const { isValidId, VISIBLE_PRODUCT, isProductBuyable } = require('../utils/helpers');

const router = express.Router();

// ตะกร้าใช้ได้เฉพาะผู้ซื้อ
router.use(auth, auth.requireRole('buyer'));

// ส่งตะกร้ากลับในรูปแบบที่หน้าเว็บใช้ได้เลย: [{ productId, quantity, product }]
async function sendCart(req, res, status = 200) {
  const cart = await Cart.findOne({ userId: req.user.id }).populate('items.productId');
  const items = (cart?.items || [])
    .filter((i) => isProductBuyable(i.productId)) // ตัดสินค้าที่ถูกลบ/ถูกระงับออก
    .map((i) => ({
      productId: i.productId._id,
      quantity: i.quantity,
      product: i.productId,
    }));
  res.status(status).json({ items });
}

router.get('/', (req, res) => sendCart(req, res));

// เพิ่มสินค้าลงตะกร้า (ถ้ามีอยู่แล้วให้บวกจำนวน ไม่เกินสต็อก)
router.post('/', async (req, res) => {
  const { productId } = req.body || {};
  const quantity = req.body?.quantity === undefined ? 1 : Number(req.body.quantity);

  if (!isValidId(productId)) return res.status(400).json({ message: 'รหัสสินค้าไม่ถูกต้อง' });
  if (!Number.isInteger(quantity) || quantity < 1) {
    return res.status(400).json({ message: 'จำนวนสินค้าไม่ถูกต้อง' });
  }

  const product = await Product.findOne({ _id: productId, ...VISIBLE_PRODUCT });
  if (!product) return res.status(404).json({ message: 'ไม่พบสินค้า' });
  if (String(product.sellerId) === String(req.user.id)) {
    return res.status(400).json({ message: 'ไม่สามารถซื้อสินค้าของตัวเองได้' });
  }
  if (product.stock < 1) return res.status(400).json({ message: 'สินค้าหมด' });

  const cart = (await Cart.findOne({ userId: req.user.id })) || new Cart({ userId: req.user.id, items: [] });
  const existing = cart.items.find((i) => String(i.productId) === String(productId));
  if (existing) existing.quantity = Math.min(existing.quantity + quantity, product.stock);
  else cart.items.push({ productId, quantity: Math.min(quantity, product.stock) });
  await cart.save();

  await sendCart(req, res, 201);
});

// ตั้งจำนวนสินค้าในตะกร้า
router.put('/:productId', async (req, res) => {
  const quantity = Number(req.body?.quantity);
  if (!Number.isInteger(quantity) || quantity < 1) {
    return res.status(400).json({ message: 'จำนวนสินค้าไม่ถูกต้อง' });
  }
  if (!isValidId(req.params.productId)) return res.status(404).json({ message: 'ไม่พบสินค้าในตะกร้า' });

  const product = await Product.findById(req.params.productId);
  if (!product) return res.status(404).json({ message: 'ไม่พบสินค้า' });

  const cart = await Cart.findOne({ userId: req.user.id });
  const item = cart?.items.find((i) => String(i.productId) === req.params.productId);
  if (!item) return res.status(404).json({ message: 'ไม่พบสินค้าในตะกร้า' });

  item.quantity = Math.min(quantity, Math.max(product.stock, 1));
  await cart.save();
  await sendCart(req, res);
});

// ลบสินค้าออกจากตะกร้า
router.delete('/:productId', async (req, res) => {
  if (!isValidId(req.params.productId)) return sendCart(req, res);
  await Cart.updateOne({ userId: req.user.id }, { $pull: { items: { productId: req.params.productId } } });
  await sendCart(req, res);
});

module.exports = router;
