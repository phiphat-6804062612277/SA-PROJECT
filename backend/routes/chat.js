const express = require('express');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Attachment = require('../models/Attachment');
const Dispute = require('../models/Dispute');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { isValidId, normalizeRole, LIMITS, VISIBLE_PRODUCT } = require('../utils/helpers');
const {
  fileUrl,
  decodeAttachment,
  quotaExceeded,
  claimAttachment,
  releaseAttachment,
  attachmentFields,
  contentDisposition,
} = require('../utils/attachments');
const { sideOf, loadPeople, previewOf, sendability, conversationView, messageView } = require('../utils/chat');

const router = express.Router();

// ทุกเส้นทางของแชตเปิดให้ผู้ใช้ที่ "ถูกแบน" เข้าได้ (เพื่อยื่นอุทธรณ์) — แต่ผู้ที่ถูกแบนใช้ได้เฉพาะห้องซัพพอร์ตของตัวเอง (ตรวจใน getConversation)
router.use(auth.allowBanned);

const PAGE_SIZE = 50;
const BURST_LIMIT = 8; // ส่งได้ไม่เกิน 8 ข้อความ / 10 วินาที ต่อบัญชี (กันสแปม)
const BURST_MS = 10_000;
const shortId = (id) => String(id).slice(-6).toUpperCase();

const notFound = { status: 404, message: 'ไม่พบการสนทนา' };

// โหลดห้องที่ผู้ใช้มีสิทธิ์เข้า → { conv, side } หรือ { fail: { status, message } }
async function getConversation(user, id) {
  if (!isValidId(String(id || ''))) return { fail: notFound };
  const conv = await Conversation.findById(id);
  const side = conv && sideOf(conv, user);
  if (!side) return { fail: notFound };
  if (user.banned && conv.type !== 'SUPPORT') {
    return { fail: { status: 403, message: 'บัญชีของคุณถูกระงับ ใช้ได้เฉพาะการติดต่อ Admin' } };
  }
  return { conv, side };
}
const respondFail = (res, fail) => res.status(fail.status).json({ message: fail.message });

// ---------------------------------------------------------------------------
// รายการห้องสนทนา
//   ผู้ซื้อ/ผู้ขาย → ห้องของตัวเอง (แชตซื้อขาย + ห้องติดต่อ Admin)   Admin → ห้องซัพพอร์ตทั้งหมด (?status=OPEN|CLOSED &topic=APPEAL|HELP &unread=1)
// ---------------------------------------------------------------------------
router.get('/conversations', async (req, res) => {
  const me = req.user;
  let filter;
  if (me.role === 'admin') {
    filter = { type: 'SUPPORT', messageCount: { $gt: 0 } };
    if (['OPEN', 'CLOSED'].includes(req.query.status)) filter.status = req.query.status;
    if (['HELP', 'APPEAL'].includes(req.query.topic)) filter.topic = req.query.topic;
    if (req.query.unread === '1') filter.unreadPeer = { $gt: 0 };
  } else {
    const mine = [{ type: 'SUPPORT', ownerId: me.id }];
    if (!me.banned) mine.push({ type: 'DIRECT', ownerId: me.id }, { type: 'DIRECT', peerId: me.id });
    filter = { $or: mine, messageCount: { $gt: 0 } };
  }

  const convs = await Conversation.find(filter).sort({ lastMessageAt: -1 }).limit(100);
  const people = await loadPeople(convs.flatMap((c) => [c.ownerId, c.peerId]));
  const out = { conversations: convs.map((c) => conversationView(c, sideOf(c, me), people, me.id)) };

  if (me.role === 'admin') {
    const base = { type: 'SUPPORT', messageCount: { $gt: 0 } };
    const [open, appeal, unread] = await Promise.all([
      Conversation.countDocuments({ ...base, status: 'OPEN' }),
      Conversation.countDocuments({ ...base, status: 'OPEN', topic: 'APPEAL' }),
      Conversation.countDocuments({ ...base, unreadPeer: { $gt: 0 } }),
    ]);
    out.counts = { open, appeal, unread };
  }
  res.json(out);
});

// ---------------------------------------------------------------------------
// เปิด/เข้าห้องแชตซื้อขาย (DIRECT)
//   ผู้ซื้อ: { sellerId, productId? } หรือ { orderId }     ผู้ขาย: { orderId } (คุยกับผู้ซื้อของออเดอร์นั้น)
//   → { id } ของห้อง (ห้องเดิมถ้าเคยคุยกันแล้ว) — ตั้ง context (สินค้า/ออเดอร์ที่กำลังสอบถาม) ให้ห้อง
// ---------------------------------------------------------------------------
router.post('/conversations', async (req, res) => {
  const me = req.user;
  if (me.banned) return res.status(403).json({ message: 'บัญชีของคุณถูกระงับ ใช้ได้เฉพาะการติดต่อ Admin' });
  if (me.role === 'admin') return res.status(403).json({ message: 'ผู้ดูแลระบบใช้ช่องทางแชตซัพพอร์ตกับผู้ใช้' });

  const body = req.body || {};
  const orderId = body.orderId === undefined || body.orderId === null ? '' : String(body.orderId);
  let buyerId;
  let sellerId;
  let order = null;

  if (orderId) {
    if (!isValidId(orderId)) return res.status(404).json({ message: 'ไม่พบคำสั่งซื้อ' });
    order = await Order.findById(orderId);
    const mine = order && (me.role === 'buyer' ? String(order.buyerId) === me.id : String(order.sellerId) === me.id);
    if (!mine) return res.status(404).json({ message: 'ไม่พบคำสั่งซื้อ' });
    buyerId = order.buyerId;
    sellerId = order.sellerId;
  } else if (me.role === 'buyer') {
    if (!isValidId(String(body.sellerId || ''))) return res.status(404).json({ message: 'ไม่พบร้านค้า' });
    buyerId = me.id;
    sellerId = String(body.sellerId);
  } else {
    return res.status(400).json({ message: 'กรุณาเลือกคำสั่งซื้อที่ต้องการสนทนากับผู้ซื้อ' });
  }

  const people = await loadPeople([buyerId, sellerId]);
  const buyer = people.get(String(buyerId));
  const seller = people.get(String(sellerId));
  if (!buyer || normalizeRole(buyer.role) !== 'buyer') return res.status(404).json({ message: 'ไม่พบผู้ซื้อ' });
  if (!seller || normalizeRole(seller.role) !== 'seller') return res.status(404).json({ message: 'ไม่พบร้านค้า' });
  const other = me.role === 'buyer' ? seller : buyer;
  if (other.isBanned) return res.status(403).json({ message: 'บัญชีของอีกฝ่ายถูกระงับ ไม่สามารถเริ่มการสนทนาได้' });
  // ร้านที่ถูกระงับ: เริ่มคุยใหม่จากหน้าร้าน/สินค้าไม่ได้ (ลูกค้าที่มีออเดอร์ค้างอยู่ยังติดต่อผ่านออเดอร์ได้)
  if (!order && seller.storeBanned) return res.status(403).json({ message: 'ร้านค้านี้ถูกระงับ ไม่สามารถเริ่มการสนทนาได้' });

  let context = null;
  if (order) {
    context = {
      kind: 'order',
      refId: order._id,
      label: `ออเดอร์ #${shortId(order._id)}`,
      imageUrl: (order.items[0]?.imageUrl || '').slice(0, 1000),
    };
  } else if (body.productId !== undefined && body.productId !== null && body.productId !== '') {
    const pid = String(body.productId);
    const product = isValidId(pid) ? await Product.findOne({ _id: pid, sellerId, ...VISIBLE_PRODUCT }) : null;
    if (!product) return res.status(404).json({ message: 'ไม่พบสินค้า' });
    context = { kind: 'product', refId: product._id, label: product.name.slice(0, 120), imageUrl: (product.imageUrl || '').slice(0, 1000) };
  }

  const filter = { type: 'DIRECT', ownerId: buyer._id, peerId: seller._id };
  const update = { $setOnInsert: { isSupportChat: false } };
  if (context) update.$set = { context };
  let conv;
  try {
    conv = await Conversation.findOneAndUpdate(filter, update, { upsert: true, new: true, setDefaultsOnInsert: true });
  } catch (err) {
    if (err?.code !== 11000) throw err;
    conv = await Conversation.findOne(filter); // สองคำขอสร้างพร้อมกัน — ใช้ห้องที่อีกคำขอสร้างไว้
  }
  res.json({ id: conv._id });
});

// ---------------------------------------------------------------------------
// เปิด/เข้าห้องติดต่อ Admin (SUPPORT)
//   ผู้ซื้อ/ผู้ขาย (รวมผู้ที่ถูกแบน = ยื่นอุทธรณ์): body ว่างได้    Admin: { userId } เพื่อเริ่มคุยกับผู้ใช้คนนั้น
// ---------------------------------------------------------------------------
router.post('/support', async (req, res) => {
  const me = req.user;
  let ownerId = me.id;
  if (me.role === 'admin') {
    const userId = String(req.body?.userId || '');
    if (!isValidId(userId)) return res.status(400).json({ message: 'กรุณาระบุผู้ใช้ที่ต้องการติดต่อ' });
    ownerId = userId;
  }
  const owner = await User.findById(ownerId).select('role isBanned storeBanned');
  if (!owner || normalizeRole(owner.role) === 'admin') return res.status(404).json({ message: 'ไม่พบผู้ใช้' });

  // บัญชีหรือร้านถูกระงับ = ยื่นอุทธรณ์ (Admin เห็นป้ายพิเศษและกรองได้)
  const topic = owner.isBanned || owner.storeBanned ? 'APPEAL' : 'HELP';
  const filter = { type: 'SUPPORT', ownerId: owner._id };
  let conv;
  try {
    conv = await Conversation.findOneAndUpdate(
      filter,
      { $setOnInsert: { isSupportChat: true, topic } }, // ห้องเดิมเปลี่ยนเป็น APPEAL/OPEN ตอนผู้ใช้ส่งข้อความจริง (ไม่ใช่แค่เปิดดู)
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    if (err?.code !== 11000) throw err;
    conv = await Conversation.findOne(filter);
  }
  res.json({ id: conv._id });
});

// ---------------------------------------------------------------------------
// อ่านห้อง + ข้อความ (แบ่งหน้าจากล่าสุดย้อนหลัง)
//   ?before=<messageId> โหลดข้อความที่เก่ากว่า   ?after=<messageId> โหลดเฉพาะข้อความที่ใหม่กว่า (ใช้ตอน polling)
//   การเรียกนี้ถือว่า "อ่านแล้ว" (ล้างตัวนับข้อความใหม่ของฝั่งผู้ดู)
// ---------------------------------------------------------------------------
router.get('/conversations/:id', async (req, res) => {
  const got = await getConversation(req.user, req.params.id);
  if (got.fail) return respondFail(res, got.fail);
  const { conv, side } = got;

  const after = String(req.query.after || '');
  const before = String(req.query.before || '');
  const filter = { conversationId: conv._id };
  let rows;
  let hasMore = false;
  if (isValidId(after)) {
    rows = await Message.find({ ...filter, _id: { $gt: after } })
      .sort({ _id: 1 })
      .limit(200);
  } else {
    if (isValidId(before)) filter._id = { $lt: before };
    const found = await Message.find(filter)
      .sort({ _id: -1 })
      .limit(PAGE_SIZE + 1);
    hasMore = found.length > PAGE_SIZE;
    rows = found.slice(0, PAGE_SIZE).reverse();
  }

  // เปิดอ่าน = ล้างตัวนับข้อความใหม่ของฝั่งเรา (ไม่ทำตอนเลื่อนอ่านย้อนหลัง)
  const unreadField = side === 'owner' ? 'unreadOwner' : 'unreadPeer';
  if (!isValidId(before) && conv[unreadField] > 0) {
    await Conversation.updateOne({ _id: conv._id, [unreadField]: { $gt: 0 } }, { [unreadField]: 0 });
    conv[unreadField] = 0;
  }

  const people = await loadPeople([conv.ownerId, conv.peerId, ...rows.map((m) => m.senderId)]);
  res.json({
    conversation: conversationView(conv, side, people, req.user.id),
    messages: rows.map((m) => messageView(m, conv, side, people)),
    hasMore,
  });
});

// ---------------------------------------------------------------------------
// ส่งข้อความ: { text?, fileUrl? } — ต้องมีข้อความหรือไฟล์แนบอย่างน้อยหนึ่งอย่าง (fileUrl ได้จาก POST /attachments)
// ---------------------------------------------------------------------------
router.post('/conversations/:id/messages', async (req, res) => {
  const me = req.user;
  const got = await getConversation(me, req.params.id);
  if (got.fail) return respondFail(res, got.fail);
  const { conv, side } = got;

  const text = String(req.body?.text ?? '').trim();
  const url = String(req.body?.fileUrl ?? '').trim();
  if (!text && !url) return res.status(400).json({ message: 'กรุณาพิมพ์ข้อความหรือแนบไฟล์' });
  if (text.length > LIMITS.CHAT_MESSAGE) {
    return res.status(400).json({ message: `ข้อความต้องไม่เกิน ${LIMITS.CHAT_MESSAGE} ตัวอักษร` });
  }

  const people = await loadPeople([conv.ownerId, conv.peerId, me.id]);
  const can = sendability(conv, side, people);
  if (!can.canSend) return res.status(403).json({ message: can.reason });

  const recent = await Message.countDocuments({ senderId: me.id, createdAt: { $gt: new Date(Date.now() - BURST_MS) } });
  if (recent >= BURST_LIMIT) return res.status(429).json({ message: 'ส่งข้อความถี่เกินไป กรุณารอสักครู่' });

  let att = null;
  if (url) {
    att = await claimAttachment(url, { ownerId: me.id, scopeType: 'CONVERSATION', scopeId: conv._id });
    if (!att) return res.status(400).json({ message: 'ไฟล์แนบไม่ถูกต้องหรือถูกใช้ไปแล้ว กรุณาแนบไฟล์ใหม่อีกครั้ง' });
  }

  const fromOwner = side === 'owner';
  let message;
  try {
    message = await Message.create({
      conversationId: conv._id,
      senderId: me.id,
      senderRole: me.role,
      receiverId: fromOwner ? conv.peerId || null : conv.ownerId,
      text,
      isSupportChat: !!conv.isSupportChat,
      ...(att ? attachmentFields(att) : {}),
    });
  } catch (err) {
    if (att) await releaseAttachment(att._id);
    throw err;
  }

  const now = message.createdAt || new Date();
  const set = {
    lastMessageAt: now,
    lastMessage: { preview: previewOf(message), at: now, bySide: fromOwner ? 'owner' : 'peer' },
  };
  if (conv.type === 'SUPPORT' && fromOwner) {
    const owner = people.get(String(conv.ownerId));
    if (owner && (owner.isBanned || owner.storeBanned) && conv.topic !== 'APPEAL') set.topic = 'APPEAL';
  }
  await Conversation.updateOne(
    { _id: conv._id },
    { $set: set, $inc: { messageCount: 1, [fromOwner ? 'unreadPeer' : 'unreadOwner']: 1 } }
  );

  res.status(201).json({ message: messageView(message, conv, side, people) });
});

// ---------------------------------------------------------------------------
// ปิด/เปิดห้องสนทนา: { status: 'CLOSED' | 'OPEN' } — สมาชิกในห้องทำได้ทุกคน (ผู้ซื้อ/ผู้ขาย/Admin ในห้องซัพพอร์ต)
//   CLOSED = อ่านได้อย่างเดียว (ส่งข้อความ/ไฟล์ไม่ได้) จนกว่าจะเปิดใหม่ · ปิดซ้ำจะไม่ทับข้อมูลว่าใครปิดคนแรก
//   แชตข้อพิพาทไม่ผ่านเส้นทางนี้ — ปิดอัตโนมัติเมื่อ Admin ตัดสิน
// ---------------------------------------------------------------------------
router.put('/conversations/:id/status', async (req, res) => {
  const status = String(req.body?.status || '');
  if (!['OPEN', 'CLOSED'].includes(status)) return res.status(400).json({ message: 'สถานะไม่ถูกต้อง' });
  const got = await getConversation(req.user, req.params.id);
  if (got.fail) return respondFail(res, got.fail);
  const { conv, side } = got;

  if (status === 'CLOSED') {
    await Conversation.updateOne(
      { _id: conv._id, status: { $ne: 'CLOSED' } },
      { $set: { status: 'CLOSED', closedAt: new Date(), closedById: req.user.id, closedBySide: side, closedByRole: normalizeRole(req.user.role) } }
    );
  } else {
    await Conversation.updateOne({ _id: conv._id }, { $set: { status: 'OPEN', closedAt: null, closedById: null, closedBySide: null, closedByRole: null } });
  }
  const updated = await Conversation.findById(conv._id);
  const people = await loadPeople([updated.ownerId, updated.peerId]);
  res.json({ conversation: conversationView(updated, side, people, req.user.id) });
});

// ---------------------------------------------------------------------------
// ไฟล์แนบ: อัปโหลด (รูป JPG/PNG/WebP + เอกสาร) → { url, name, mime, size, kind } แล้วนำ url ไปส่งกับข้อความ
//   body: { scope: 'conversation' | 'dispute', scopeId, fileName, dataUrl }  (body ใหญ่ได้ 2MB — ตั้งไว้ใน app.js)
// ---------------------------------------------------------------------------
router.post('/attachments', async (req, res) => {
  const me = req.user;
  const body = req.body || {};
  const scope = String(body.scope || '');
  const scopeId = String(body.scopeId || '');

  let scopeType;
  let scopeObjectId;
  if (scope === 'conversation') {
    const got = await getConversation(me, scopeId);
    if (got.fail) return respondFail(res, got.fail);
    const people = await loadPeople([got.conv.ownerId, got.conv.peerId]);
    const can = sendability(got.conv, got.side, people);
    if (!can.canSend) return res.status(403).json({ message: can.reason });
    scopeType = 'CONVERSATION';
    scopeObjectId = got.conv._id;
  } else if (scope === 'dispute') {
    if (me.banned) return res.status(403).json({ message: 'บัญชีของคุณถูกระงับ ใช้ได้เฉพาะการติดต่อ Admin' });
    const dispute = isValidId(scopeId) ? await Dispute.findById(scopeId).select('buyerId sellerId status') : null;
    const member = dispute && (me.role === 'admin' || String(dispute.buyerId) === me.id || String(dispute.sellerId) === me.id);
    if (!member) return res.status(404).json({ message: 'ไม่พบข้อพิพาท' });
    if (dispute.status !== 'PENDING') return res.status(400).json({ message: 'ข้อพิพาทนี้ตัดสินแล้ว ไม่สามารถแนบไฟล์เพิ่มได้' });
    scopeType = 'DISPUTE';
    scopeObjectId = dispute._id;
  } else {
    return res.status(400).json({ message: 'ประเภทการแนบไฟล์ไม่ถูกต้อง' });
  }

  const decoded = decodeAttachment(body.dataUrl, body.fileName);
  if (decoded.error) return res.status(400).json({ message: decoded.error });
  if (await quotaExceeded(me.id)) {
    return res.status(429).json({ message: 'แนบไฟล์ได้จำกัดต่อวัน กรุณาลองใหม่ภายหลัง' });
  }

  const att = await Attachment.create({
    ownerId: me.id,
    scopeType,
    scopeId: scopeObjectId,
    kind: decoded.kind,
    mime: decoded.mime,
    name: decoded.name,
    size: decoded.buffer.length,
    data: decoded.buffer,
  });
  res.status(201).json({ id: att._id, url: fileUrl(att._id), name: att.name, mime: att.mime, size: att.size, kind: att.kind });
});

// ดาวน์โหลด/ดูไฟล์แนบ (ไม่สาธารณะ — เฉพาะสมาชิกของห้อง/ข้อพิพาทนั้น; ไฟล์ที่ยังไม่ได้ส่งเห็นได้เฉพาะเจ้าของ)
router.get('/files/:id', async (req, res) => {
  const me = req.user;
  if (!isValidId(req.params.id)) return res.status(404).json({ message: 'ไม่พบไฟล์' });
  const att = await Attachment.findById(req.params.id).select('+data');
  if (!att) return res.status(404).json({ message: 'ไม่พบไฟล์' });

  let allowed = false;
  if (!att.attached) {
    allowed = String(att.ownerId) === me.id;
  } else if (att.scopeType === 'CONVERSATION') {
    const conv = await Conversation.findById(att.scopeId);
    allowed = !!conv && !!sideOf(conv, me) && !(me.banned && conv.type !== 'SUPPORT');
  } else if (att.scopeType === 'DISPUTE' && !me.banned) {
    const d = await Dispute.findById(att.scopeId).select('buyerId sellerId');
    allowed = !!d && (me.role === 'admin' || String(d.buyerId) === me.id || String(d.sellerId) === me.id);
  }
  if (!allowed) return res.status(404).json({ message: 'ไม่พบไฟล์' });

  res.set({
    'Content-Type': att.mime,
    'Content-Disposition': contentDisposition(att.name, att.kind === 'image'),
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox", // เปิดตรงๆ ในแท็บก็รันสคริปต์ไม่ได้
    'Cache-Control': 'private, max-age=3600',
  });
  res.send(Buffer.from(att.data));
});

module.exports = router;
