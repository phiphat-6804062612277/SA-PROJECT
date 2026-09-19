const express = require('express');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { requireRole } = auth;
const { credit, debitIfEnough } = require('../utils/wallet');
const { isValidId } = require('../utils/helpers');

const router = express.Router();

/*
 * Escrow flow
 *   checkout  : หักเงินผู้ซื้อ → เงินถูก "ถือ" ไว้ที่ Order (escrowStatus = HELD)
 *   ship      : ผู้ขายใส่เลขพัสดุ  PENDING_SHIPMENT → SHIPPED
 *   complete  : ผู้ซื้อกดยืนยันรับของ SHIPPED → COMPLETED → โอนเงินเข้า Wallet ผู้ขาย (RELEASED)
 *   cancel    : ก่อนจัดส่ง (PENDING_SHIPMENT) ผู้ซื้อหรือผู้ขายยกเลิกได้ → คืนเงิน + คืนสต็อก (REFUNDED)
 *
 * การเปลี่ยนสถานะทุกครั้งใช้ findOneAndUpdate แบบมีเงื่อนไขสถานะเดิม จึงกดซ้ำ/กดพร้อมกัน
 * ก็ไม่ทำให้เงินถูกโอนหรือคืนซ้ำสองรอบ
 */

// ---------------------------------------------------------------- checkout
router.post('/checkout', auth, requireRole('buyer'), async (req, res) => {
  const body = req.body || {};
  const buyer = await User.findById(req.user.id);
  if (!buyer) return res.status(404).json({ message: 'ไม่พบข้อมูลผู้ใช้' });

  const shippingAddress = String(body.shippingAddress || buyer.address || '').trim();
  if (!shippingAddress) {
    return res.status(400).json({ message: 'กรุณาระบุที่อยู่จัดส่งก่อนชำระเงิน' });
  }

  // 1) เลือกสินค้าจากตะกร้า (ถ้าส่ง productIds มา = เฉพาะที่ติ๊กเลือก)
  const cart = await Cart.findOne({ userId: req.user.id });
  let cartItems = cart?.items || [];
  if (Array.isArray(body.productIds)) {
    const wanted = new Set(body.productIds.map(String));
    cartItems = cartItems.filter((i) => wanted.has(String(i.productId)));
  }
  if (cartItems.length === 0) return res.status(400).json({ message: 'ไม่มีสินค้าที่เลือกในตะกร้า' });

  // 2) ตรวจสินค้า + คำนวณราคาจากฐานข้อมูล (ไม่เชื่อราคาจาก client)
  const products = await Product.find({ _id: { $in: cartItems.map((i) => i.productId) } });
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const lines = [];
  for (const item of cartItems) {
    const p = byId.get(String(item.productId));
    if (!p || p.isActive === false) {
      return res.status(400).json({ message: 'มีสินค้าในตะกร้าที่ถูกลบออกจากร้านแล้ว กรุณานำออกจากตะกร้า' });
    }
    if (String(p.sellerId) === String(req.user.id)) {
      return res.status(400).json({ message: 'ไม่สามารถซื้อสินค้าของตัวเองได้' });
    }
    if (p.stock < item.quantity) {
      return res.status(400).json({ message: `สินค้า "${p.name}" มีในสต็อกไม่พอ (เหลือ ${p.stock} ชิ้น)` });
    }
    lines.push({ product: p, quantity: item.quantity });
  }

  const total = lines.reduce((sum, l) => sum + l.product.price * l.quantity, 0);

  // 3) หักเงินผู้ซื้อ (atomic)
  const wallet = await debitIfEnough(req.user.id, total);
  if (!wallet) return res.status(400).json({ message: 'ยอดเงินคงเหลือใน Wallet ไม่เพียงพอ' });

  // ถ้าขั้นตอนไหนพลาด ให้คืนทุกอย่างกลับสู่สภาพเดิม
  const reservedLines = [];
  const createdOrders = [];
  const rollback = async () => {
    for (const o of createdOrders) {
      await Transaction.deleteMany({ referenceOrderId: o._id });
      await Order.deleteOne({ _id: o._id });
    }
    for (const l of reservedLines) {
      await Product.updateOne({ _id: l.product._id }, { $inc: { stock: l.quantity } });
    }
    await credit(req.user.id, total, { type: 'REFUND', description: 'คืนเงิน: ทำรายการสั่งซื้อไม่สำเร็จ' });
  };

  try {
    // 4) จองสต็อก (atomic ต่อสินค้า)
    for (const l of lines) {
      const ok = await Product.findOneAndUpdate(
        { _id: l.product._id, isActive: { $ne: false }, stock: { $gte: l.quantity } },
        { $inc: { stock: -l.quantity } }
      );
      if (!ok) {
        await rollback();
        return res.status(409).json({ message: `สินค้า "${l.product.name}" เพิ่งหมดสต็อก กรุณาลองใหม่` });
      }
      reservedLines.push(l);
    }

    // 5) สร้าง Order แยกตามผู้ขาย (1 ผู้ขาย = 1 Order)
    const bySeller = new Map();
    for (const l of lines) {
      const key = String(l.product.sellerId);
      if (!bySeller.has(key)) bySeller.set(key, []);
      bySeller.get(key).push(l);
    }

    for (const [sellerId, sellerLines] of bySeller) {
      const order = await Order.create({
        buyerId: req.user.id,
        sellerId,
        items: sellerLines.map((l) => ({
          productId: l.product._id,
          name: l.product.name,
          imageUrl: l.product.imageUrl,
          quantity: l.quantity,
          price: l.product.price,
        })),
        totalAmount: sellerLines.reduce((s, l) => s + l.product.price * l.quantity, 0),
        shippingName: buyer.name,
        shippingPhone: buyer.phone,
        shippingAddress,
      });
      createdOrders.push(order);

      await Transaction.create({
        walletId: wallet._id,
        type: 'PAYMENT',
        amount: order.totalAmount,
        description: 'ชำระค่าสินค้า (Escrow ถือเงินไว้จนกว่าจะยืนยันรับสินค้า)',
        referenceOrderId: order._id,
      });
    }
  } catch (err) {
    await rollback().catch((e) => console.error('Rollback failed:', e));
    throw err;
  }

  // 6) เอาสินค้าที่ซื้อแล้วออกจากตะกร้า
  await Cart.updateOne(
    { userId: req.user.id },
    { $pull: { items: { productId: { $in: lines.map((l) => l.product._id) } } } }
  );

  res.status(201).json({ message: 'สั่งซื้อสำเร็จ เงินถูกถือไว้ในระบบ Escrow', orders: createdOrders, balance: wallet.balance });
});

// ------------------------------------------------------------------- lists
// คำสั่งซื้อของฉัน (ผู้ซื้อ)
router.get('/mine', auth, async (req, res) => {
  const orders = await Order.find({ buyerId: req.user.id })
    .sort({ createdAt: -1 })
    .populate('sellerId', 'name');
  res.json(orders);
});

// ออเดอร์ที่เข้ามาที่ร้านฉัน (ผู้ขาย)
router.get('/selling', auth, requireRole('seller'), async (req, res) => {
  const orders = await Order.find({ sellerId: req.user.id })
    .sort({ createdAt: -1 })
    .populate('buyerId', 'name phone');
  res.json(orders);
});

// -------------------------------------------------------------- transitions
const findOwnedId = (req, res) => {
  if (!isValidId(req.params.id)) {
    res.status(404).json({ message: 'ไม่พบคำสั่งซื้อ' });
    return false;
  }
  return true;
};

// อธิบายว่าทำไมเปลี่ยนสถานะไม่ได้ (ใช้หลัง findOneAndUpdate ได้ null)
async function explainFailure(orderId, party, userId) {
  const order = await Order.findById(orderId);
  if (!order) return { status: 404, message: 'ไม่พบคำสั่งซื้อ' };
  if (String(order[party]) !== String(userId)) return { status: 403, message: 'คุณไม่มีสิทธิ์จัดการคำสั่งซื้อนี้' };
  return { status: 400, message: `ทำรายการนี้ไม่ได้ในสถานะปัจจุบัน (${order.status})` };
}

// ผู้ขายใส่เลขพัสดุ
router.put('/:id/ship', auth, requireRole('seller'), async (req, res) => {
  if (!findOwnedId(req, res)) return;
  const trackingNumber = String(req.body?.trackingNumber || '').trim();
  if (!trackingNumber) return res.status(400).json({ message: 'กรุณาระบุเลขพัสดุ' });

  const order = await Order.findOneAndUpdate(
    { _id: req.params.id, sellerId: req.user.id, status: 'PENDING_SHIPMENT' },
    { status: 'SHIPPED', trackingNumber, shippedAt: new Date() },
    { new: true }
  );
  if (!order) {
    const f = await explainFailure(req.params.id, 'sellerId', req.user.id);
    return res.status(f.status).json({ message: f.message });
  }
  res.json({ message: 'อัปเดตสถานะเป็นจัดส่งแล้ว', order });
});

// ผู้ซื้อยืนยันรับสินค้า → ปล่อยเงินให้ผู้ขาย
router.put('/:id/complete', auth, requireRole('buyer'), async (req, res) => {
  if (!findOwnedId(req, res)) return;

  const order = await Order.findOneAndUpdate(
    { _id: req.params.id, buyerId: req.user.id, status: 'SHIPPED' },
    { status: 'COMPLETED', escrowStatus: 'RELEASED', completedAt: new Date() },
    { new: true }
  );
  if (!order) {
    const f = await explainFailure(req.params.id, 'buyerId', req.user.id);
    return res.status(f.status).json({ message: f.message });
  }

  try {
    await credit(order.sellerId, order.totalAmount, {
      type: 'RECEIVE_PAYMENT',
      description: 'รับเงินจากการขายสินค้า (ผู้ซื้อยืนยันรับสินค้าแล้ว)',
      orderId: order._id,
    });
  } catch (err) {
    // โอนเงินไม่สำเร็จ → ย้อนสถานะให้ผู้ซื้อกดยืนยันใหม่ได้ ไม่ให้เงินหาย
    await Order.updateOne({ _id: order._id }, { status: 'SHIPPED', escrowStatus: 'HELD', $unset: { completedAt: 1 } });
    throw err;
  }
  res.json({ message: 'ยืนยันรับสินค้าแล้ว เงินถูกโอนให้ผู้ขาย', order });
});

// ยกเลิกก่อนจัดส่ง (ผู้ซื้อหรือผู้ขาย) → คืนเงิน + คืนสต็อก
router.put('/:id/cancel', auth, async (req, res) => {
  if (!findOwnedId(req, res)) return;
  const role = req.user.role;
  if (role !== 'buyer' && role !== 'seller') return res.status(403).json({ message: 'ไม่มีสิทธิ์ยกเลิกคำสั่งซื้อ' });

  const party = role === 'seller' ? 'sellerId' : 'buyerId';
  const order = await Order.findOneAndUpdate(
    { _id: req.params.id, [party]: req.user.id, status: 'PENDING_SHIPMENT' },
    { status: 'CANCELLED', escrowStatus: 'REFUNDED', cancelledAt: new Date(), cancelledBy: role },
    { new: true }
  );
  if (!order) {
    const f = await explainFailure(req.params.id, party, req.user.id);
    if (f.status === 400) f.message = 'ยกเลิกได้เฉพาะคำสั่งซื้อที่ยังไม่จัดส่ง';
    return res.status(f.status).json({ message: f.message });
  }

  await credit(order.buyerId, order.totalAmount, {
    type: 'REFUND',
    description: role === 'seller' ? 'คืนเงิน: ผู้ขายยกเลิกคำสั่งซื้อ' : 'คืนเงิน: ยกเลิกคำสั่งซื้อ',
    orderId: order._id,
  });
  for (const item of order.items) {
    await Product.updateOne({ _id: item.productId }, { $inc: { stock: item.quantity } });
  }
  res.json({ message: 'ยกเลิกคำสั่งซื้อและคืนเงินเรียบร้อยแล้ว', order });
});

module.exports = router;
