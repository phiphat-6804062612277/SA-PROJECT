const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const auth = require('../middleware/auth');

// 1. ดึงรายการสินค้าทั้งหมด (สำหรับหน้า Shopping / buyers)
// Endpoint: GET /api/products
router.get('/', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

// 2. ดึงรายละเอียดสินค้าตาม ID (แก้จาก /products/:id เป็น /:id)
// Endpoint: GET /api/products/:id
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'ไม่พบสินค้า' });
    }
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: 'ID สินค้าไม่ถูกต้องหรือเกิดข้อผิดพลาด', error: err.message });
  }
});

// 3. เพิ่มสินค้าใหม่ (เฉพาะ SELLER)
// Endpoint: POST /api/products
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'SELLER') {
      return res.status(403).json({ message: 'สิทธิ์ไม่ถูกต้อง: เฉพาะผู้ขายเท่านั้นที่ลงสินค้าได้' });
    }

    const { name, description, price, stock, imageUrl } = req.body;

    const product = new Product({
      sellerId: req.user.id,
      name,
      description,
      price,
      stock,
      imageUrl
    });

    await product.save();
    res.status(201).json({ message: 'ลงขายสินค้าสำเร็จ', product });
  } catch (err) {
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

module.exports = router;