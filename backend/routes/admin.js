const express = require('express');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Dispute = require('../models/Dispute');
const { releaseToSeller, refundToBuyer, autoReleaseTime } = require('../utils/escrow');
const { buildDetail, RESOLVED_STATUSES, STATUS_TEXT } = require('../utils/disputes');
const auth = require('../middleware/auth');
const { isValidId, escapeRegex, normalizeRole, LIMITS, HttpError } = require('../utils/helpers');

const router = express.Router();

// ทุก route ในไฟล์นี้ใช้ได้เฉพาะ Admin
router.use(auth, auth.requireRole('admin'));

const adminUserView = (u) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: normalizeRole(u.role),
  phone: u.phone || '',
  storeName: u.storeName || '',
  avatarUrl: u.avatarUrl || '',
  storeLogoUrl: u.storeLogoUrl || '',
  isBanned: !!u.isBanned,
  banReason: u.banReason || '',
  storeBanned: !!u.storeBanned,
  storeBanReason: u.storeBanReason || '',
  createdAt: u.createdAt,
});

const reasonOf = (req) => String(req.body?.reason || '').trim().slice(0, LIMITS.BAN_REASON);

// โหลดผู้ใช้เป้าหมาย พร้อมตรวจว่าแบนได้ (ห้ามแบน Admin / ตัวเอง)
async function loadTarget(req, res, { sellerOnly = false } = {}) {
  if (!isValidId(req.params.id)) {
    res.status(404).json({ message: 'ไม่พบผู้ใช้' });
    return null;
  }
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404).json({ message: 'ไม่พบผู้ใช้' });
    return null;
  }
  if (user.role === 'admin' || String(user._id) === req.user.id) {
    res.status(400).json({ message: 'ไม่สามารถดำเนินการกับบัญชี Admin ได้' });
    return null;
  }
  if (sellerOnly && user.role !== 'seller') {
    res.status(400).json({ message: 'ผู้ใช้นี้ไม่ใช่ผู้ขาย' });
    return null;
  }
  return user;
}

// สินค้าของผู้ขายจะถูกระงับเมื่อ "บัญชี" หรือ "ร้าน" อย่างใดอย่างหนึ่งถูกแบน
const syncSuspension = (user) =>
  Product.updateMany({ sellerId: user._id }, { suspended: !!(user.isBanned || user.storeBanned) });

router.get('/stats', async (req, res) => {
  const [users, sellers, products, orders, bannedUsers, bannedStores, pendingDisputes] = await Promise.all([
    User.countDocuments({ role: { $ne: 'admin' } }),
    User.countDocuments({ role: 'seller' }),
    Product.countDocuments({ isActive: { $ne: false } }),
    Order.countDocuments(),
    User.countDocuments({ isBanned: true }),
    User.countDocuments({ storeBanned: true }),
    Dispute.countDocuments({ status: 'PENDING' }),
  ]);
  res.json({ users, sellers, products, orders, bannedUsers, bannedStores, pendingDisputes });
});

// ผู้ใช้ทั้งหมด: ?q=ค้นหาชื่อ/อีเมล/ชื่อร้าน  ?role=buyer|seller
router.get('/users', async (req, res) => {
  const filter = { role: { $ne: 'admin' } };
  if (['buyer', 'seller'].includes(req.query.role)) filter.role = req.query.role;
  if (req.query.q) {
    const re = new RegExp(escapeRegex(String(req.query.q).trim().slice(0, 100)), 'i');
    filter.$or = [{ name: re }, { email: re }, { storeName: re }];
  }
  const users = await User.find(filter).sort({ createdAt: -1 }).limit(100);
  res.json(users.map(adminUserView));
});

// แบน/ปลดแบน "บัญชี" (Buyer หรือ Seller) — บัญชีที่ถูกแบนล็อกอิน/ใช้ API ไม่ได้ทันที และสินค้าของผู้ขายถูกซ่อน
router.put('/users/:id/ban', async (req, res) => {
  const user = await loadTarget(req, res);
  if (!user) return;
  user.isBanned = true;
  user.banReason = reasonOf(req);
  await user.save();
  await syncSuspension(user);
  res.json({ message: 'ระงับบัญชีผู้ใช้แล้ว', user: adminUserView(user) });
});

router.put('/users/:id/unban', async (req, res) => {
  const user = await loadTarget(req, res);
  if (!user) return;
  user.isBanned = false;
  user.banReason = '';
  await user.save();
  await syncSuspension(user);
  res.json({ message: 'ปลดระงับบัญชีผู้ใช้แล้ว', user: adminUserView(user) });
});

// แบน/ปลดแบน "ร้านค้า" — ผู้ขายยังล็อกอิน/ถอนเงิน/จัดส่งออเดอร์เดิมได้ แต่สินค้าถูกซ่อนและลงขายเพิ่มไม่ได้
router.put('/stores/:id/ban', async (req, res) => {
  const user = await loadTarget(req, res, { sellerOnly: true });
  if (!user) return;
  user.storeBanned = true;
  user.storeBanReason = reasonOf(req);
  await user.save();
  await syncSuspension(user);
  res.json({ message: 'ระงับร้านค้าแล้ว', user: adminUserView(user) });
});

router.put('/stores/:id/unban', async (req, res) => {
  const user = await loadTarget(req, res, { sellerOnly: true });
  if (!user) return;
  user.storeBanned = false;
  user.storeBanReason = '';
  await user.save();
  await syncSuspension(user);
  res.json({ message: 'ปลดระงับร้านค้าแล้ว', user: adminUserView(user) });
});

// สินค้าทั้งหมดในระบบ (?q=ชื่อสินค้า)
router.get('/products', async (req, res) => {
  const filter = { isActive: { $ne: false } };
  if (req.query.q) filter.name = new RegExp(escapeRegex(String(req.query.q).trim().slice(0, 100)), 'i');
  const products = await Product.find(filter)
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('sellerId', 'name storeName');
  res.json(
    products.map((p) => {
      const o = p.toObject();
      o.seller = o.sellerId?._id ? { id: o.sellerId._id, name: o.sellerId.name, storeName: o.sellerId.storeName } : null;
      o.sellerId = o.sellerId?._id || o.sellerId;
      return o;
    })
  );
});

// ลบสินค้า (ซ่อนถาวรจากหน้าร้าน/ตะกร้า — ประวัติออเดอร์เดิมยังอยู่)
router.delete('/products/:id', async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(404).json({ message: 'ไม่พบสินค้า' });
  const product = await Product.findOneAndUpdate(
    { _id: req.params.id, isActive: { $ne: false } },
    { isActive: false, removedByAdmin: true },
    { new: true }
  );
  if (!product) return res.status(404).json({ message: 'ไม่พบสินค้า' });
  res.json({ message: 'ลบสินค้าเรียบร้อยแล้ว' });
});

// ================================================================ ข้อพิพาท (Dispute Resolution)
// รายการข้อพิพาท: ?status=PENDING|RESOLVED|ALL (ค่าเริ่มต้น ALL)  ?q=เลขออเดอร์/รหัสข้อพิพาท/ชื่อผู้ซื้อ/ชื่อผู้ขาย/ชื่อร้าน
router.get('/disputes', async (req, res) => {
  const filter = {};
  const status = String(req.query.status || 'ALL').toUpperCase();
  if (status === 'PENDING') filter.status = 'PENDING';
  else if (status === 'RESOLVED') filter.status = { $in: RESOLVED_STATUSES };

  const q = String(req.query.q || '').trim().slice(0, 100);
  if (q) {
    if (isValidId(q)) {
      filter.$or = [{ orderId: q }, { _id: q }];
    } else if (/^#?[a-f0-9]{6}$/i.test(q)) {
      // เลขออเดอร์แบบสั้นที่แสดงบนหน้าจอ (#ABC123 = 6 ตัวท้ายของ id)
      filter.$or = [{ $expr: { $regexMatch: { input: { $toString: '$orderId' }, regex: `${q.replace('#', '')}$`, options: 'i' } } }];
    } else {
      const re = new RegExp(escapeRegex(q), 'i');
      const people = await User.find({ $or: [{ name: re }, { email: re }, { storeName: re }] }).select('_id').limit(200);
      const ids = people.map((u) => u._id);
      filter.$or = [{ buyerId: { $in: ids } }, { sellerId: { $in: ids } }];
    }
  }

  const disputes = await Dispute.find(filter).sort({ createdAt: -1 }).limit(100).select('-messages');
  const userIds = [...new Set(disputes.flatMap((d) => [String(d.buyerId), String(d.sellerId)]))];
  const users = await User.find({ _id: { $in: userIds } }).select('name storeName');
  const byId = new Map(users.map((u) => [String(u._id), u]));

  res.json(
    disputes.map((d) => {
      const b = byId.get(String(d.buyerId));
      const s = byId.get(String(d.sellerId));
      return {
        id: d._id,
        orderId: d.orderId,
        status: d.status,
        statusText: STATUS_TEXT[d.status],
        amount: d.amount,
        reason: d.reason,
        createdAt: d.createdAt,
        resolvedAt: d.resolvedAt || null,
        buyer: { id: d.buyerId, name: b?.name || '-' },
        seller: { id: d.sellerId, name: s?.name || '-', storeName: s?.storeName || '' },
      };
    })
  );
});

router.get('/disputes/:id', async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(404).json({ message: 'ไม่พบข้อพิพาท' });
  const dispute = await Dispute.findById(req.params.id);
  if (!dispute) return res.status(404).json({ message: 'ไม่พบข้อพิพาท' });
  res.json(await buildDetail(dispute, { includeContact: true }));
});

const DECISIONS = {
  REFUND_BUYER: 'RESOLVED_REFUND_BUYER',
  PAY_SELLER: 'RESOLVED_PAY_SELLER',
  REJECT: 'REJECTED',
};

// ตัดสินข้อพิพาท  body: { decision: 'REFUND_BUYER' | 'PAY_SELLER' | 'REJECT', adminNote }
//   REFUND_BUYER : Order → REFUNDED, เงินจาก Escrow คืนเข้า Wallet ผู้ซื้อ
//   PAY_SELLER   : Order → COMPLETED, เงินจาก Escrow โอนเข้า Wallet ผู้ขาย
//   REJECT       : ปฏิเสธคำร้อง Order กลับเป็น SHIPPED และเริ่มนับ Auto-Release ใหม่ (เปิดข้อพิพาทซ้ำอีกไม่ได้)
// ต้องระบุ adminNote ทุกครั้ง และตัดสินซ้ำไม่ได้ (ต้องเป็น PENDING เท่านั้น — เปลี่ยนสถานะแบบ atomic)
router.put('/disputes/:id/resolve', async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(404).json({ message: 'ไม่พบข้อพิพาท' });

  const decision = req.body?.decision;
  const newStatus = typeof decision === 'string' && Object.hasOwn(DECISIONS, decision) ? DECISIONS[decision] : undefined;
  if (!newStatus) return res.status(400).json({ message: 'ต้องระบุคำตัดสิน (REFUND_BUYER, PAY_SELLER หรือ REJECT)' });

  const adminNote = String(req.body?.adminNote || '').trim();
  if (adminNote.length < LIMITS.DISPUTE_NOTE_MIN) {
    return res.status(400).json({ message: `กรุณาระบุเหตุผลการตัดสินอย่างน้อย ${LIMITS.DISPUTE_NOTE_MIN} ตัวอักษร` });
  }
  if (adminNote.length > LIMITS.DISPUTE_NOTE) {
    return res.status(400).json({ message: `เหตุผลการตัดสินต้องไม่เกิน ${LIMITS.DISPUTE_NOTE} ตัวอักษร` });
  }

  // 1) "จอง" การตัดสินก่อน (PENDING → ผลตัดสิน) — กดซ้ำ/กดพร้อมกันจะได้ null
  const dispute = await Dispute.findOneAndUpdate(
    { _id: req.params.id, status: 'PENDING' },
    { status: newStatus, adminNote, resolvedAt: new Date(), resolvedBy: req.user.id },
    { new: true }
  );
  if (!dispute) {
    const exists = await Dispute.exists({ _id: req.params.id });
    return exists
      ? res.status(409).json({ message: 'ข้อพิพาทนี้ถูกตัดสินไปแล้ว ไม่สามารถตัดสินซ้ำได้' })
      : res.status(404).json({ message: 'ไม่พบข้อพิพาท' });
  }

  // 2) ทำตามคำตัดสินกับออเดอร์/เงิน — ถ้าพลาดให้คืนข้อพิพาทเป็น PENDING เพื่อตัดสินใหม่ได้
  try {
    const orderFilter = { _id: dispute.orderId, status: 'DISPUTED' };
    let order;
    if (newStatus === 'RESOLVED_REFUND_BUYER') order = await refundToBuyer(orderFilter);
    else if (newStatus === 'RESOLVED_PAY_SELLER') order = await releaseToSeller(orderFilter, { by: 'admin' });
    else {
      order = await Order.findOneAndUpdate(
        { ...orderFilter, escrowStatus: 'HELD' },
        { status: 'SHIPPED', autoReleaseAt: autoReleaseTime(new Date()) },
        { new: true }
      );
    }
    if (!order) throw new HttpError(409, 'สถานะออเดอร์ไม่ตรงกับข้อพิพาท (ไม่อยู่ในสถานะ DISPUTED) จึงดำเนินการไม่ได้');
  } catch (err) {
    await Dispute.updateOne(
      { _id: dispute._id },
      { status: 'PENDING', adminNote: '', $unset: { resolvedAt: 1, resolvedBy: 1 } }
    );
    throw err;
  }

  res.json({ message: STATUS_TEXT[newStatus], dispute: await buildDetail(dispute, { includeContact: true }) });
});

module.exports = router;
