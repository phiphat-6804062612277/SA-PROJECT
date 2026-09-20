const express = require('express');
const Dispute = require('../models/Dispute');
const Order = require('../models/Order');
const auth = require('../middleware/auth');
const { requireRole } = auth;
const { isValidId, LIMITS } = require('../utils/helpers');
const { buildDetail } = require('../utils/disputes');
const { claimAttachment, releaseAttachment, attachmentFields } = require('../utils/attachments');

const router = express.Router();
router.use(auth);

const MAX_MESSAGES = 200;

// รูปหลักฐาน: รับเป็นลิงก์ http(s) (ยังไม่มีระบบอัปโหลดไฟล์) — คืน { error } หรือ { images }
function parseEvidence(input) {
  if (input === undefined || input === null || input === '') return { images: [] };
  const list = Array.isArray(input) ? input : String(input).split(/\r?\n/);
  const images = [...new Set(list.map((s) => String(s).trim()).filter(Boolean))];
  if (images.length > LIMITS.DISPUTE_IMAGES) {
    return { error: `แนบรูปหลักฐานได้ไม่เกิน ${LIMITS.DISPUTE_IMAGES} รูป` };
  }
  for (const url of images) {
    let ok = url.length <= 1000;
    try {
      const u = new URL(url);
      ok = ok && (u.protocol === 'http:' || u.protocol === 'https:');
    } catch {
      ok = false;
    }
    if (!ok) return { error: 'ลิงก์รูปหลักฐานต้องขึ้นต้นด้วย http:// หรือ https:// และยาวไม่เกิน 1,000 ตัวอักษร' };
  }
  return { images };
}

// ผู้ซื้อขอเปิดข้อพิพาท / ขอคืนเงิน — ได้เฉพาะออเดอร์สถานะ SHIPPED ที่ยังไม่ครบกำหนดปล่อยเงินอัตโนมัติ
router.post('/', requireRole('buyer'), async (req, res) => {
  const body = req.body || {};
  const orderId = String(body.orderId || '');
  if (!isValidId(orderId)) return res.status(404).json({ message: 'ไม่พบคำสั่งซื้อ' });

  const reason = String(body.reason || '').trim();
  if (reason.length < LIMITS.DISPUTE_REASON_MIN) {
    return res.status(400).json({ message: `กรุณาอธิบายเหตุผลอย่างน้อย ${LIMITS.DISPUTE_REASON_MIN} ตัวอักษร` });
  }
  if (reason.length > LIMITS.DISPUTE_REASON) {
    return res.status(400).json({ message: `เหตุผลต้องไม่เกิน ${LIMITS.DISPUTE_REASON} ตัวอักษร` });
  }
  const { error, images } = parseEvidence(body.evidenceImages);
  if (error) return res.status(400).json({ message: error });

  if (await Dispute.exists({ orderId })) {
    return res.status(409).json({ message: 'คำสั่งซื้อนี้เคยเปิดข้อพิพาทแล้ว' });
  }

  // 1) Freeze: SHIPPED → DISPUTED (atomic) และยกเลิกการนับถอยหลัง Auto-Release ทันที
  const now = new Date();
  const before = await Order.findOneAndUpdate(
    {
      _id: orderId,
      buyerId: req.user.id,
      status: 'SHIPPED',
      escrowStatus: 'HELD',
      // ยังไม่ถึงกำหนดปล่อยเงินอัตโนมัติ (null = ออเดอร์เก่าที่ Worker ยังไม่ backfill)
      $or: [{ autoReleaseAt: null }, { autoReleaseAt: { $gt: now } }],
    },
    { status: 'DISPUTED', disputedAt: now, autoReleaseAt: null },
    { new: false }
  );
  if (!before) {
    const o = await Order.findById(orderId);
    if (!o) return res.status(404).json({ message: 'ไม่พบคำสั่งซื้อ' });
    if (String(o.buyerId) !== req.user.id) {
      return res.status(403).json({ message: 'คุณไม่มีสิทธิ์จัดการคำสั่งซื้อนี้' });
    }
    if (o.status !== 'SHIPPED') {
      return res.status(400).json({ message: `เปิดข้อพิพาทได้เฉพาะคำสั่งซื้อที่สถานะ "จัดส่งแล้ว" (ปัจจุบัน: ${o.status})` });
    }
    return res.status(400).json({ message: 'พ้นกำหนดเปิดข้อพิพาทแล้ว ระบบกำลังปล่อยเงินให้ผู้ขายตามเงื่อนไข Auto-Release' });
  }

  // 2) สร้างข้อพิพาท (ถ้าพลาดให้ย้อนออเดอร์กลับเป็น SHIPPED เหมือนเดิม)
  let dispute;
  try {
    dispute = await Dispute.create({
      orderId: before._id,
      buyerId: before.buyerId,
      sellerId: before.sellerId,
      reason,
      evidenceImages: images,
      amount: before.totalAmount,
    });
    await Order.updateOne({ _id: before._id }, { disputeId: dispute._id });
  } catch (err) {
    await Order.updateOne(
      { _id: before._id },
      { status: 'SHIPPED', autoReleaseAt: before.autoReleaseAt, $unset: { disputedAt: 1 } }
    );
    if (err?.code === 11000) return res.status(409).json({ message: 'คำสั่งซื้อนี้เคยเปิดข้อพิพาทแล้ว' });
    throw err;
  }

  res.status(201).json({
    message: 'เปิดข้อพิพาทแล้ว เงินถูกระงับไว้ใน Escrow และยกเลิกการปล่อยเงินอัตโนมัติ รอ Admin พิจารณา',
    dispute: await buildDetail(dispute),
  });
});

// โหลดข้อพิพาทที่ผู้ใช้มีสิทธิ์เห็น (ผู้ซื้อ/ผู้ขายของออเดอร์นั้น หรือ Admin)
async function loadAccessible(req, res) {
  if (!isValidId(req.params.id)) {
    res.status(404).json({ message: 'ไม่พบข้อพิพาท' });
    return null;
  }
  const dispute = await Dispute.findById(req.params.id);
  const me = req.user.id;
  const allowed =
    dispute && (req.user.role === 'admin' || String(dispute.buyerId) === me || String(dispute.sellerId) === me);
  if (!allowed) {
    res.status(404).json({ message: 'ไม่พบข้อพิพาท' });
    return null;
  }
  return dispute;
}

router.get('/:id', async (req, res) => {
  const dispute = await loadAccessible(req, res);
  if (!dispute) return;
  res.json(await buildDetail(dispute, { includeContact: req.user.role === 'admin' }));
});

// ส่งข้อความในข้อพิพาท (ผู้ซื้อ / ผู้ขาย / Admin) — ทำได้เฉพาะขณะยังไม่ตัดสิน
// body: { text?, fileUrl? } — แนบรูป/เอกสารได้ (อัปโหลดก่อนที่ POST /api/chat/attachments ด้วย scope = 'dispute')
router.post('/:id/messages', async (req, res) => {
  const dispute = await loadAccessible(req, res);
  if (!dispute) return;

  const text = String(req.body?.text || '').trim();
  const url = String(req.body?.fileUrl || '').trim();
  if (!text && !url) return res.status(400).json({ message: 'กรุณาพิมพ์ข้อความหรือแนบไฟล์' });
  if (text.length > LIMITS.DISPUTE_MESSAGE) {
    return res.status(400).json({ message: `ข้อความต้องไม่เกิน ${LIMITS.DISPUTE_MESSAGE} ตัวอักษร` });
  }

  if (dispute.status === 'PENDING' && dispute.messages.length >= MAX_MESSAGES) {
    return res.status(400).json({ message: 'ข้อความในข้อพิพาทนี้เต็มแล้ว' });
  }

  let att = null;
  if (url) {
    att = await claimAttachment(url, { ownerId: req.user.id, scopeType: 'DISPUTE', scopeId: dispute._id });
    if (!att) return res.status(400).json({ message: 'ไฟล์แนบไม่ถูกต้องหรือถูกใช้ไปแล้ว กรุณาแนบไฟล์ใหม่อีกครั้ง' });
  }

  const updated = await Dispute.findOneAndUpdate(
    { _id: dispute._id, status: 'PENDING' },
    { $push: { messages: { senderId: req.user.id, senderRole: req.user.role, text, ...(att ? attachmentFields(att) : {}) } } },
    { new: true }
  );
  if (!updated) {
    if (att) await releaseAttachment(att._id);
    return res.status(400).json({ message: 'ข้อพิพาทนี้ตัดสินแล้ว ไม่สามารถส่งข้อความเพิ่มได้' });
  }
  res.status(201).json(await buildDetail(updated, { includeContact: req.user.role === 'admin' }));
});

module.exports = router;
