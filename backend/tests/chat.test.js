const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';
process.env.ADMIN_SIGNUP_CODE = 'admin-secret';

const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Attachment = require('../models/Attachment');
const Dispute = require('../models/Dispute');
const Order = require('../models/Order');
const { runImageCleanup } = require('../jobs/imageCleanup');
const { runMigrations } = require('../utils/migrations');

let mongod;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Order.init();
  await Dispute.init();
  await Conversation.init(); // unique partial index ของห้อง DIRECT / SUPPORT
});
after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
beforeEach(async () => {
  for (const c of Object.values(mongoose.connection.collections)) await c.deleteMany({});
});

const api = () => request(app);
async function register(role, name = role, extra = {}) {
  const res = await api()
    .post('/api/auth/register')
    .send({ name, email: `${name}@t.com`, password: '123456', role, address: '1 Test Rd', ...extra });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return { token: res.body.token, user: res.body.user };
}
const as = (t) => ({ Authorization: `Bearer ${typeof t === 'string' ? t : t.token}` });
const admin = () => register('admin', 'admin', { adminCode: 'admin-secret' });
async function newProduct(seller, over = {}) {
  const res = await api().post('/api/products').set(as(seller)).send({ name: 'Panel', price: 1000, stock: 5, ...over });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.product;
}
async function placeOrder(seller, buyer) {
  const p = await newProduct(seller);
  await api().post('/api/wallet/topup').set(as(buyer)).send({ amount: 5000 });
  await api().post('/api/cart').set(as(buyer)).send({ productId: p._id, quantity: 1 });
  const co = await api().post('/api/orders/checkout').set(as(buyer)).send({ shippingAddress: '9 Ship St' });
  assert.equal(co.status, 201, JSON.stringify(co.body));
  return co.body.orders[0];
}
const ship = (seller, order, trackingNumber) => api().put(`/api/orders/${order._id}/ship`).set(as(seller)).send({ trackingNumber });

// ไฟล์ตัวอย่าง (เฉพาะส่วนหัวที่ backend ใช้ตรวจชนิดไฟล์)
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n');
const durl = (buf, mime = 'application/octet-stream') => `data:${mime};base64,${buf.toString('base64')}`;
const attach = (who, scope, scopeId, fileName, buf, mime) =>
  api().post('/api/chat/attachments').set(as(who)).send({ scope, scopeId, fileName, dataUrl: durl(buf, mime) });

async function openDirect(buyer, body) {
  const r = await api().post('/api/chat/conversations').set(as(buyer)).send(body);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body.id;
}
const send = (who, id, body) => api().post(`/api/chat/conversations/${id}/messages`).set(as(who)).send(body);
const read = (who, id, qs = '') => api().get(`/api/chat/conversations/${id}${qs}`).set(as(who));
const list = async (who, qs = '') => (await api().get(`/api/chat/conversations${qs}`).set(as(who))).body;
const notes = async (who) => (await api().get('/api/notifications').set(as(who))).body;

test('direct chat: buyer ↔ store, one room per pair, unread counters, polling, read receipts', async () => {
  const seller = await register('seller');
  const buyer = await register('buyer');
  const stranger = await register('buyer', 'stranger');
  const a = await admin();
  const p = await newProduct(seller);

  // ต้องล็อกอิน / Admin ใช้แชตซื้อขายไม่ได้ / ผู้ขายเริ่มเองโดยไม่มีออเดอร์ไม่ได้
  assert.equal((await api().post('/api/chat/conversations').send({ sellerId: seller.user.id })).status, 401);
  assert.equal((await api().post('/api/chat/conversations').set(as(a)).send({ sellerId: seller.user.id })).status, 403);
  assert.equal((await api().post('/api/chat/conversations').set(as(seller)).send({ sellerId: buyer.user.id })).status, 400);
  assert.equal((await api().post('/api/chat/conversations').set(as(buyer)).send({ sellerId: 'xyz' })).status, 404);
  assert.equal((await api().post('/api/chat/conversations').set(as(buyer)).send({ sellerId: buyer.user.id })).status, 404); // ไม่ใช่ผู้ขาย
  assert.equal((await api().post('/api/chat/conversations').set(as(buyer)).send({ sellerId: seller.user.id, productId: 'a'.repeat(24) })).status, 404);

  const id = await openDirect(buyer, { sellerId: seller.user.id, productId: p._id });
  assert.equal(await openDirect(buyer, { sellerId: seller.user.id }), id); // เปิดซ้ำได้ห้องเดิม
  assert.equal((await list(buyer)).conversations.length, 0); // ยังไม่มีข้อความ → ไม่แสดงในรายการ

  // ตรวจสิทธิ์ห้อง
  assert.equal((await read(stranger, id)).status, 404);
  assert.equal((await read(a, id)).status, 404); // Admin ไม่เห็นแชตซื้อขายส่วนตัว
  assert.equal((await send(stranger, id, { text: 'hi' })).status, 404);

  assert.equal((await send(buyer, id, {})).status, 400);
  assert.equal((await send(buyer, id, { text: '   ' })).status, 400);
  assert.equal((await send(buyer, id, { text: 'x'.repeat(1001) })).status, 400);
  const m1 = await send(buyer, id, { text: 'สนใจแผงนี้ครับ ส่งวันไหน' });
  assert.equal(m1.status, 201, JSON.stringify(m1.body));
  assert.equal(m1.body.message.mine, true);
  assert.equal(m1.body.message.messageType, 'TEXT');

  // ฝั่งผู้ขาย: มีข้อความใหม่ 1 ห้อง, Badge/แจ้งเตือนขึ้น
  const sl = (await list(seller)).conversations;
  assert.equal(sl.length, 1);
  assert.equal(sl[0].unread, 1);
  assert.equal(sl[0].counterpart.name, 'buyer');
  assert.equal(sl[0].context.kind, 'product');
  assert.equal(sl[0].context.href, `/product/${p._id}`);
  assert.equal(sl[0].lastMessage.fromMe, false);
  const sn = await notes(seller);
  assert.equal(sn.items.find((i) => i.key === 'chat_unread').count, 1);
  assert.equal(sn.items.find((i) => i.key === 'chat_unread').entries[0].href, `/chat/${id}`);
  assert.equal((await list(buyer)).conversations[0].unread, 0); // ผู้ส่งไม่มี unread ของตัวเอง

  // ผู้ขายเปิดอ่าน = อ่านแล้ว + เห็นข้อความเป็นของอีกฝ่าย ; ผู้ซื้อเห็นผู้ขายเป็น "ร้าน"
  const view = await read(seller, id);
  assert.equal(view.status, 200);
  assert.equal(view.body.messages.length, 1);
  assert.equal(view.body.messages[0].mine, false);
  assert.equal(view.body.messages[0].senderName, 'buyer');
  assert.equal((await list(seller)).conversations[0].unread, 0);
  assert.equal((await notes(seller)).total, 0);

  const reply = await send(seller, id, { text: 'พรุ่งนี้ส่งได้เลยครับ' });
  assert.equal(reply.body.message.senderRole, 'seller');
  const bv = await read(buyer, id);
  assert.equal(bv.body.conversation.counterpart.role, 'seller');
  assert.equal(bv.body.conversation.unread, 0);
  assert.deepEqual(bv.body.messages.map((m) => m.mine), [true, false]);

  // polling: ขอเฉพาะที่ใหม่กว่า
  const lastId = bv.body.messages[1].id;
  await send(buyer, id, { text: 'โอเคครับ' });
  const poll = await read(seller, id, `?after=${lastId}`);
  assert.deepEqual(poll.body.messages.map((m) => m.text), ['โอเคครับ']);
  assert.equal((await read(seller, id, `?after=${poll.body.messages[0].id}`)).body.messages.length, 0);

  // Message เก็บ senderId / receiverId / messageType / isSupportChat ตามสคีมา
  const stored = await Message.find({ conversationId: id }).sort({ _id: 1 });
  assert.equal(String(stored[0].senderId), buyer.user.id);
  assert.equal(String(stored[0].receiverId), seller.user.id);
  assert.equal(String(stored[1].receiverId), buyer.user.id);
  assert.equal(stored[0].messageType, 'TEXT');
  assert.equal(stored[0].isSupportChat, false);
});

test('direct chat: seller opens from an order, pagination, blocked when the other party is banned, spam limit', async () => {
  const seller = await register('seller');
  const buyer = await register('buyer');
  const other = await register('buyer', 'other');
  const a = await admin();
  const order = await placeOrder(seller, buyer);

  // ผู้ขายเปิดแชตจากออเดอร์ / ผู้ซื้อคนอื่นใช้ออเดอร์นี้ไม่ได้
  const id = await openDirect(seller, { orderId: order._id });
  assert.equal(await openDirect(buyer, { orderId: order._id }), id);
  assert.equal((await api().post('/api/chat/conversations').set(as(other)).send({ orderId: order._id })).status, 404);
  assert.equal((await api().post('/api/chat/conversations').set(as(buyer)).send({ orderId: 'zzz' })).status, 404);
  await send(seller, id, { text: 'ได้รับออเดอร์แล้วครับ' });
  const v = await read(buyer, id);
  assert.equal(v.body.conversation.context.kind, 'order');
  assert.equal(v.body.conversation.context.href, '/history');
  assert.equal((await read(seller, id)).body.conversation.context.href, '/seller/orders');

  // แบ่งหน้า: 50 ข้อความล่าสุด + ย้อนหลังด้วย before (ตัดความถี่โดยเขียนตรงลงฐานข้อมูล)
  const now = Date.now();
  await Message.insertMany(
    Array.from({ length: 60 }, (_, i) => ({
      conversationId: id,
      senderId: buyer.user.id,
      senderRole: 'buyer',
      receiverId: seller.user.id,
      text: `m${i}`,
      createdAt: new Date(now - 60_000 + i),
    }))
  );
  const first = await read(buyer, id);
  assert.equal(first.body.messages.length, 50);
  assert.equal(first.body.hasMore, true);
  const older = await read(buyer, id, `?before=${first.body.messages[0].id}`);
  assert.equal(older.body.messages.length, 11); // 60 + 1 = 61 ข้อความ รวมกับหน้าแรก 50
  assert.equal(older.body.hasMore, false);

  // ส่งถี่เกินไป → 429 (Message ที่เพิ่ง insert ข้างบนเป็นของ 60 วินาทีก่อน จึงไม่นับ)
  let last;
  for (let i = 0; i < 9; i += 1) last = await send(buyer, id, { text: `spam ${i}` });
  assert.equal(last.status, 429);

  // ฝั่งตรงข้ามถูกแบน → ส่งไม่ได้ / เริ่มห้องใหม่ไม่ได้
  await api().put(`/api/admin/users/${buyer.user.id}/ban`).set(as(a)).send({ reason: 'spam' });
  const blocked = await send(seller, id, { text: 'สวัสดี' });
  assert.equal(blocked.status, 403);
  assert.match(blocked.body.message, /ถูกระงับ/);
  assert.equal((await read(seller, id)).body.conversation.canSend, false);
  assert.equal((await api().post('/api/chat/conversations').set(as(seller)).send({ orderId: order._id })).status, 403);
});

test('store banned: cannot start a new chat from the store page, existing customers with an order still can', async () => {
  const seller = await register('seller');
  const buyer = await register('buyer');
  const a = await admin();
  const order = await placeOrder(seller, buyer);

  await api().put(`/api/admin/stores/${seller.user.id}/ban`).set(as(a)).send({ reason: 'x' });
  assert.equal((await api().post('/api/chat/conversations').set(as(buyer)).send({ sellerId: seller.user.id })).status, 403);
  const id = await openDirect(buyer, { orderId: order._id }); // มีออเดอร์ค้างอยู่ยังติดต่อได้
  assert.equal((await send(buyer, id, { text: 'ออเดอร์ผมยังจัดส่งไหมครับ' })).status, 201);
  assert.equal((await send(seller, id, { text: 'จัดส่งวันนี้ครับ' })).status, 201); // ร้านที่ถูกระงับยังตอบลูกค้าเดิมได้
});

test('attachments: images + documents, real content only, private to the room, single use', async () => {
  const seller = await register('seller');
  const buyer = await register('buyer');
  const stranger = await register('buyer', 'stranger');
  const id = await openDirect(buyer, { sellerId: seller.user.id });

  // ต้องล็อกอิน / ต้องเป็นสมาชิกห้อง / ประเภทต้องถูก
  assert.equal((await api().post('/api/chat/attachments').send({})).status, 401);
  assert.equal((await attach(stranger, 'conversation', id, 'a.png', PNG)).status, 404);
  assert.equal((await api().post('/api/chat/attachments').set(as(buyer)).send({ scope: 'x', scopeId: id })).status, 400);

  // ปฏิเสธไฟล์ที่ไม่รองรับ/ปลอม
  const exe = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(100)]);
  assert.equal((await attach(buyer, 'conversation', id, 'virus.exe', exe)).status, 400);
  assert.equal((await attach(buyer, 'conversation', id, 'fake.pdf', Buffer.from('<html>hi</html>'))).status, 400); // นามสกุล pdf แต่ไม่ใช่ PDF
  assert.equal((await attach(buyer, 'conversation', id, 'noext', PDF)).status, 400);
  assert.equal((await attach(buyer, 'conversation', id, 'x.svg', Buffer.from('<svg/>'))).status, 400);
  assert.equal((await attach(buyer, 'conversation', id, 'bin.txt', Buffer.from([1, 2, 0, 3, 4]))).status, 400); // txt แต่เป็นไบนารี
  assert.equal((await attach(buyer, 'conversation', id, 'p.pdf', Buffer.concat([PDF, Buffer.alloc(1024 * 1024 + 1)]))).status, 400); // >1MB
  assert.equal((await api().post('/api/chat/attachments').set(as(buyer)).send({ scope: 'conversation', scopeId: id, fileName: 'a.png', dataUrl: 'nope' })).status, 400);
  assert.equal((await api().post('/api/chat/attachments').set(as(buyer)).send({ scope: 'conversation', scopeId: id, fileName: 'a.png', dataUrl: 'data:image/png;base64,@@@' })).status, 400);

  // รูป + PDF ผ่าน (body > 100kb ต้องไม่โดน 413 เพราะเส้นทางนี้ขยาย limit เป็น 2MB)
  const bigPng = Buffer.concat([PNG, Buffer.alloc(300 * 1024)]);
  const img = await attach(buyer, 'conversation', id, '../../รูปแผงโซล่า.png', bigPng, 'image/png');
  assert.equal(img.status, 201, JSON.stringify(img.body));
  assert.equal(img.body.kind, 'image');
  assert.equal(img.body.mime, 'image/png');
  assert.equal(img.body.name, 'รูปแผงโซล่า.png'); // ตัดพาธออก เก็บชื่อภาษาไทยได้
  const doc = await attach(buyer, 'conversation', id, 'ใบเสนอราคา.pdf', PDF, 'application/pdf');
  assert.equal(doc.status, 201, JSON.stringify(doc.body));
  assert.equal(doc.body.kind, 'file');
  assert.equal((await attach(buyer, 'conversation', id, 'data.csv', Buffer.from('a,b\n1,2\n'))).status, 201);
  assert.equal((await attach(buyer, 'conversation', id, 'sheet.xlsx', Buffer.concat([Buffer.from([0x50, 0x4b, 3, 4]), Buffer.alloc(20)]))).status, 201);
  assert.equal((await attach(buyer, 'conversation', id, 'old.doc', Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(20)]))).status, 201);

  // ยังไม่ส่ง: เฉพาะเจ้าของดูได้
  assert.equal((await api().get(img.body.url).set(as(buyer))).status, 200);
  assert.equal((await api().get(img.body.url).set(as(seller))).status, 404);
  assert.equal((await api().get(img.body.url)).status, 401);

  // ส่งรูป + ไฟล์ (ไม่มีข้อความก็ได้)
  const sent = await send(buyer, id, { fileUrl: img.body.url });
  assert.equal(sent.status, 201, JSON.stringify(sent.body));
  assert.equal(sent.body.message.messageType, 'IMAGE');
  assert.equal(sent.body.message.fileUrl, img.body.url);
  assert.equal(sent.body.message.fileName, 'รูปแผงโซล่า.png');
  assert.equal(sent.body.message.text, '');
  const sentDoc = await send(buyer, id, { text: 'ใบเสนอราคาครับ', fileUrl: doc.body.url });
  assert.equal(sentDoc.body.message.messageType, 'FILE');
  assert.equal(sentDoc.body.message.fileMime, 'application/pdf');

  // ใช้ไฟล์เดิมซ้ำไม่ได้ / ใช้ไฟล์ของคนอื่น-ห้องอื่นไม่ได้ / url แปลกๆ ไม่ผ่าน
  assert.equal((await send(buyer, id, { fileUrl: img.body.url })).status, 400);
  const theirs = await attach(seller, 'conversation', id, 'b.png', PNG);
  assert.equal((await send(buyer, id, { fileUrl: theirs.body.url })).status, 400);
  const otherRoom = await openDirect(stranger, { sellerId: seller.user.id });
  const mine = await attach(stranger, 'conversation', otherRoom, 'c.png', PNG);
  assert.equal((await send(stranger, id, { fileUrl: mine.body.url })).status, 404); // ไม่ใช่สมาชิกห้อง id
  assert.equal((await send(buyer, id, { fileUrl: '/api/images/' + 'a'.repeat(24) })).status, 400);
  assert.equal((await send(buyer, id, { fileUrl: 'https://evil.example/x.png' })).status, 400);
  const wrongScope = await attach(buyer, 'conversation', id, 'd.png', PNG);
  const room2 = await openDirect(buyer, { sellerId: (await register('seller', 'seller2')).user.id });
  assert.equal((await send(buyer, room2, { fileUrl: wrongScope.body.url })).status, 400); // อัปโหลดไว้ห้องอื่น

  // ดาวน์โหลด: สมาชิกห้องได้ (รูป inline / เอกสาร attachment + ชื่อไทย), คนนอก 404
  const dl = await api().get(doc.body.url).set(as(seller));
  assert.equal(dl.status, 200);
  assert.equal(dl.headers['content-type'], 'application/pdf');
  assert.match(dl.headers['content-disposition'], /^attachment; filename=".*"; filename\*=UTF-8''%E0%B9%83/);
  assert.equal(dl.headers['x-content-type-options'], 'nosniff');
  assert.match(dl.headers['content-security-policy'], /sandbox/);
  assert.equal(Number(dl.headers['content-length']), PDF.length); // ส่งไฟล์ครบตามขนาดจริง
  const view = await api().get(img.body.url).set(as(seller));
  assert.match(view.headers['content-disposition'], /^inline;/);
  assert.equal((await api().get(doc.body.url).set(as(stranger))).status, 404);
  assert.equal((await api().get('/api/chat/files/xyz').set(as(buyer))).status, 404);
  assert.equal((await api().get('/api/chat/files/' + '0'.repeat(24)).set(as(buyer))).status, 404);

  // ห้องแสดงประเภทข้อความ + ตัวอย่างในรายการห้อง
  const bv = await read(seller, id);
  assert.deepEqual(bv.body.messages.map((m) => m.messageType), ['IMAGE', 'FILE']);
  const rooms = (await list(seller)).conversations;
  const mineRoom = rooms.find((r) => String(r.id) === String(id));
  assert.match(mineRoom.lastMessage.preview, /ใบเสนอราคาครับ/);
});

test('attachment quota per day and cleanup of files uploaded but never sent', async () => {
  const seller = await register('seller');
  const buyer = await register('buyer');
  const id = await openDirect(buyer, { sellerId: seller.user.id });

  const keep = await attach(buyer, 'conversation', id, 'keep.png', PNG);
  await send(buyer, id, { fileUrl: keep.body.url });
  const orphan = await attach(buyer, 'conversation', id, 'orphan.png', PNG);
  const fresh = await attach(buyer, 'conversation', id, 'fresh.png', PNG);

  const oid = (r) => new mongoose.Types.ObjectId(String(r.body.id));
  const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
  await Attachment.collection.updateMany({ _id: { $in: [oid(keep), oid(orphan)] } }, { $set: { createdAt: old } });
  const r = await runImageCleanup();
  assert.equal(r.attachmentsRemoved, 1); // ส่งแล้ว (keep) เก็บไว้ตามประวัติแชต / ใหม่ (fresh) ยังไม่ถึงกำหนด
  assert.equal((await api().get(orphan.body.url).set(as(buyer))).status, 404);
  assert.equal((await api().get(keep.body.url).set(as(seller))).status, 200);
  assert.equal((await api().get(fresh.body.url).set(as(buyer))).status, 200);

  // โควตา 60 ไฟล์ต่อวัน (ที่อัปโหลดไปแล้ว: keep, orphan(ลบแล้วไม่นับ), fresh = 2)
  const heavy = await register('buyer', 'heavy');
  const room = await openDirect(heavy, { sellerId: seller.user.id });
  for (let i = 0; i < 60; i += 1) {
    await Attachment.create({ ownerId: heavy.user.id, scopeType: 'CONVERSATION', scopeId: room, kind: 'image', mime: 'image/png', name: `q${i}.png`, size: 10, data: PNG });
  }
  assert.equal((await attach(heavy, 'conversation', room, 'over.png', PNG)).status, 429);
  assert.equal((await attach(buyer, 'conversation', id, 'ok.png', PNG)).status, 201); // บัญชีอื่นไม่โดนผลกระทบ
});

test('banned user appeal: login gives a limited appeal token that only opens the Admin support chat', async () => {
  const seller = await register('seller');
  const buyer = await register('buyer');
  const a = await admin();
  const direct = await openDirect(buyer, { sellerId: seller.user.id });
  await send(buyer, direct, { text: 'ก่อนโดนแบน' });

  await api().put(`/api/admin/users/${buyer.user.id}/ban`).set(as(a)).send({ reason: 'โกงเงิน' });

  // ล็อกอินไม่ผ่าน (ไม่ได้ token ปกติ) แต่ได้ appealToken + เหตุผล
  const login = await api().post('/api/auth/login').send({ email: 'buyer@t.com', password: '123456' });
  assert.equal(login.status, 403);
  assert.equal(login.body.code, 'BANNED');
  assert.equal(login.body.banReason, 'โกงเงิน');
  assert.ok(!login.body.token);
  const appeal = login.body.appealToken;
  assert.ok(appeal);
  // รหัสผ่านผิด → ไม่ได้ appealToken
  const wrong = await api().post('/api/auth/login').send({ email: 'buyer@t.com', password: 'nope' });
  assert.equal(wrong.status, 400);
  assert.ok(!wrong.body.appealToken);

  // appeal token ใช้กับ API อื่นไม่ได้
  assert.equal((await api().get('/api/wallet').set(as(appeal))).status, 401);
  assert.equal((await api().get('/api/notifications').set(as(appeal))).status, 401);
  assert.equal((await api().post('/api/uploads').set(as(appeal)).send({ kind: 'avatar' })).status, 401);
  // token ปกติเดิมของผู้ที่ถูกแบนกลางคัน: API ทั่วไปได้ BANNED (พร้อมเหตุผล) แต่แชตซัพพอร์ตยังใช้ได้
  const old = await api().get('/api/wallet').set(as(buyer));
  assert.equal(old.status, 403);
  assert.equal(old.body.banReason, 'โกงเงิน');

  // เปิดห้องซัพพอร์ต (ยื่นอุทธรณ์) แล้วส่งข้อความ + แนบไฟล์
  const open = await api().post('/api/chat/support').set(as(appeal)).send({});
  assert.equal(open.status, 200, JSON.stringify(open.body));
  const sid = open.body.id;
  assert.equal((await api().post('/api/chat/support').set(as(buyer)).send({})).body.id, sid); // ใช้ token เดิมก็ได้ห้องเดียวกัน
  const m = await send(appeal, sid, { text: 'ผมไม่ได้ทำครับ ขออุทธรณ์' });
  assert.equal(m.status, 201, JSON.stringify(m.body));
  const proof = await attach(appeal, 'conversation', sid, 'หลักฐาน.pdf', PDF);
  assert.equal(proof.status, 201, JSON.stringify(proof.body));
  assert.equal((await send(appeal, sid, { text: 'แนบหลักฐาน', fileUrl: proof.body.url })).status, 201);
  const conv = await Conversation.findById(sid);
  assert.equal(conv.topic, 'APPEAL');
  assert.equal(conv.isSupportChat, true);
  assert.equal((await Message.findOne({ conversationId: sid })).isSupportChat, true);
  assert.equal((await Message.findOne({ conversationId: sid })).receiverId, null); // ส่งถึงทีม Admin

  // ห้ามเข้าแชตซื้อขายและอย่างอื่นระหว่างถูกแบน
  assert.equal((await read(appeal, direct)).status, 403);
  assert.equal((await send(appeal, direct, { text: 'x' })).status, 403);
  assert.equal((await api().post('/api/chat/conversations').set(as(appeal)).send({ sellerId: seller.user.id })).status, 403);
  assert.equal((await attach(appeal, 'conversation', direct, 'x.png', PNG)).status, 403);
  assert.equal((await list(appeal)).conversations.length, 1); // เห็นเฉพาะห้องซัพพอร์ต
  assert.equal((await list(appeal)).conversations[0].counterpart.name, 'ทีมงาน Solify (Admin)');
  assert.equal((await list(seller)).conversations.length, 1); // ผู้ขายยังเห็นห้องเดิมแต่ส่งหาผู้ถูกแบนไม่ได้
  assert.equal((await send(seller, direct, { text: 'สวัสดี' })).status, 403);

  // Admin: เห็นในรายการ (ป้ายอุทธรณ์ + Badge + สถานะแบนของผู้ใช้) แล้วตอบกลับ
  const al = await list(a);
  assert.equal(al.conversations.length, 1);
  assert.equal(al.conversations[0].topic, 'APPEAL');
  assert.equal(al.conversations[0].unread, 2);
  assert.deepEqual(al.counts, { appeal: 1, unread: 1 }); // ไม่มีสถานะห้องแล้ว: นับเฉพาะห้องที่รอ Admin อ่าน
  assert.equal((await list(a, '?topic=HELP')).conversations.length, 0);
  assert.equal((await notes(a)).items.find((i) => i.key === 'chat_unread').count, 1);
  const av = await read(a, sid);
  assert.equal(av.body.conversation.owner.isBanned, true);
  assert.equal(av.body.conversation.owner.banReason, 'โกงเงิน');
  assert.equal(av.body.conversation.owner.email, 'buyer@t.com');
  assert.equal(av.body.messages[1].fileName, 'หลักฐาน.pdf');
  assert.equal((await api().get(proof.body.url).set(as(a))).status, 200); // Admin ดูหลักฐานได้
  assert.equal((await list(a)).conversations[0].unread, 0);

  const rep = await send(a, sid, { text: 'รับเรื่องแล้ว กำลังตรวจสอบ' });
  assert.equal(rep.status, 201);
  assert.equal(rep.body.message.mine, true);
  const uv = await read(appeal, sid);
  assert.equal(uv.body.messages[2].senderName, 'Admin'); // ผู้ใช้เห็นเป็น "Admin" ไม่ใช่ชื่อจริง
  assert.equal(uv.body.messages[2].mine, false);
  assert.equal(uv.body.conversation.account.isBanned, true);
  assert.equal(uv.body.conversation.owner, undefined); // ไม่ส่งอีเมลของตัวเองกลับมาเป็น owner (เฉพาะ Admin)

  // ไม่มีระบบปิดแชต: ห้องไม่มีสถานะ OPEN/CLOSED และไม่มี endpoint ปิด/เปิดห้อง — ผู้ที่ถูกแบนส่งข้อความ/แนบไฟล์ต่อได้เสมอ
  assert.equal(uv.body.conversation.status, undefined);
  assert.equal(uv.body.conversation.closedBy, undefined);
  assert.equal(uv.body.conversation.canSend, true);
  assert.equal((await api().put(`/api/chat/conversations/${sid}/status`).set(as(a)).send({ status: 'CLOSED' })).status, 404);
  assert.equal((await send(appeal, sid, { text: 'ขอบคุณครับ' })).status, 201);
  assert.equal((await attach(appeal, 'conversation', sid, 'x.png', PNG)).status, 201);
  assert.equal((await Conversation.findById(sid).lean()).status, undefined);

  // ปลดแบนแล้ว appeal token ใช้ไม่ได้ → ต้องล็อกอินปกติ, ล็อกอินได้แล้ว และยังเห็นห้องซัพพอร์ตเดิม
  await api().put(`/api/admin/users/${buyer.user.id}/unban`).set(as(a));
  const gone = await api().get(`/api/chat/conversations/${sid}`).set(as(appeal));
  assert.equal(gone.status, 401);
  const again = await api().post('/api/auth/login').send({ email: 'buyer@t.com', password: '123456' });
  assert.equal(again.status, 200);
  assert.equal((await list(again.body)).conversations.length, 2);
  // ผู้ซื้อที่ปกติแล้วได้ Badge เมื่อ Admin ตอบ
  await send(a, sid, { text: 'ปลดแบนให้แล้วครับ' });
  assert.equal((await notes(again.body)).items.find((i) => i.key === 'chat_unread').count, 1);
});

test('support chat: any user can contact Admin, store ban = appeal topic, admin can start a chat with a user', async () => {
  const seller = await register('seller');
  const buyer = await register('buyer');
  const a = await admin();

  // ร้านถูกระงับ (บัญชียังล็อกอินได้) → ยื่นอุทธรณ์ผ่านแชตซัพพอร์ตปกติ
  await api().put(`/api/admin/stores/${seller.user.id}/ban`).set(as(a)).send({ reason: 'สินค้าไม่เหมาะสม' });
  const sid = (await api().post('/api/chat/support').set(as(seller)).send({})).body.id;
  await send(seller, sid, { text: 'ขอเปิดร้านอีกครั้งครับ' });
  const sc = await Conversation.findById(sid);
  assert.equal(sc.topic, 'APPEAL');
  assert.equal((await read(seller, sid)).body.conversation.account.storeBanned, true);
  assert.equal((await read(a, sid)).body.conversation.owner.storeBanReason, 'สินค้าไม่เหมาะสม');

  // ผู้ซื้อทั่วไปขอความช่วยเหลือ = HELP
  const hid = (await api().post('/api/chat/support').set(as(buyer)).send({})).body.id;
  await send(buyer, hid, { text: 'ถอนเงินไม่ได้ครับ' });
  assert.equal((await Conversation.findById(hid)).topic, 'HELP');
  assert.equal((await list(a, '?topic=APPEAL')).conversations.length, 1);
  assert.equal((await list(a)).conversations.length, 2);
  assert.equal((await list(a, '?unread=1')).conversations.length, 1); // ห้องของผู้ขายถูก Admin เปิดอ่านไปแล้วข้างบน

  // Admin ใช้ /support ต้องระบุผู้ใช้ / เริ่มคุยกับ Admin ด้วยกันไม่ได้ / ผู้ใช้อื่นเข้าห้องไม่ได้
  assert.equal((await api().post('/api/chat/support').set(as(a)).send({})).status, 400);
  assert.equal((await api().post('/api/chat/support').set(as(a)).send({ userId: a.user.id })).status, 404);
  assert.equal((await read(buyer, sid)).status, 404);
  assert.equal((await api().post('/api/chat/support').set(as(a)).send({ userId: buyer.user.id })).body.id, hid);

  // Admin เริ่มคุยกับผู้ใช้ที่ยังไม่เคยติดต่อมา
  const fresh = await register('buyer', 'fresh');
  const fid = (await api().post('/api/chat/support').set(as(a)).send({ userId: fresh.user.id })).body.id;
  assert.equal((await send(a, fid, { text: 'ทีมงานติดต่อเรื่องคำร้องของคุณครับ' })).status, 201);
  const fl = (await list(fresh)).conversations;
  assert.equal(fl.length, 1);
  assert.equal(fl[0].unread, 1);
  assert.equal(fl[0].isSupportChat, true);
  assert.equal(fl[0].counterpart.role, 'admin');
});

test('dispute chat accepts attachments from buyer, seller and admin; files stay private to the dispute', async () => {
  const seller = await register('seller');
  const buyer = await register('buyer');
  const stranger = await register('buyer', 'stranger');
  const a = await admin();
  const order = await placeOrder(seller, buyer);
  assert.equal((await ship(seller, order, 'DISPUTE0001')).status, 200);
  const d = (await api().post('/api/disputes').set(as(buyer)).send({ orderId: order._id, reason: 'สินค้าไม่ตรงปกครับ' })).body.dispute;

  assert.equal((await attach(stranger, 'dispute', d.id, 'x.png', PNG)).status, 404);
  assert.equal((await attach(buyer, 'dispute', 'nope', 'x.png', PNG)).status, 404);
  assert.equal((await attach(buyer, 'dispute', d.id, 'x.exe', Buffer.from('MZ'))).status, 400);

  // ข้อความล้วน / ไฟล์ล้วน / ทั้งคู่ — ต้องมีอย่างน้อยหนึ่งอย่าง
  const empty = await api().post(`/api/disputes/${d.id}/messages`).set(as(buyer)).send({});
  assert.equal(empty.status, 400);
  const pic = await attach(buyer, 'dispute', d.id, 'หลักฐาน.png', PNG);
  assert.equal(pic.status, 201, JSON.stringify(pic.body));
  const m1 = await api().post(`/api/disputes/${d.id}/messages`).set(as(buyer)).send({ fileUrl: pic.body.url });
  assert.equal(m1.status, 201, JSON.stringify(m1.body));
  assert.equal(m1.body.messages[0].messageType, 'IMAGE');
  assert.equal(m1.body.messages[0].fileUrl, pic.body.url);
  assert.equal(m1.body.messages[0].text, '');
  const doc = await attach(seller, 'dispute', d.id, 'ใบส่งของ.pdf', PDF);
  const m2 = await api().post(`/api/disputes/${d.id}/messages`).set(as(seller)).send({ text: 'ใบส่งของครับ', fileUrl: doc.body.url });
  assert.equal(m2.status, 201);
  assert.equal(m2.body.messages[1].messageType, 'FILE');
  assert.equal(m2.body.messages[1].fileName, 'ใบส่งของ.pdf');
  // ใช้ซ้ำ / ไฟล์ของห้องแชตอื่นไม่ได้
  assert.equal((await api().post(`/api/disputes/${d.id}/messages`).set(as(buyer)).send({ fileUrl: pic.body.url })).status, 400);
  const room = await openDirect(buyer, { sellerId: seller.user.id });
  const chatFile = await attach(buyer, 'conversation', room, 'c.png', PNG);
  assert.equal((await api().post(`/api/disputes/${d.id}/messages`).set(as(buyer)).send({ fileUrl: chatFile.body.url })).status, 400);

  // ดาวน์โหลด: คู่กรณีและ Admin ได้ คนนอกไม่ได้
  for (const who of [buyer, seller, a]) assert.equal((await api().get(pic.body.url).set(as(who))).status, 200);
  assert.equal((await api().get(pic.body.url).set(as(stranger))).status, 404);
  // Admin เห็นในหน้าพิจารณาข้อพิพาท
  const detail = (await api().get(`/api/admin/disputes/${d.id}`).set(as(a))).body;
  assert.equal(detail.messages[0].messageType, 'IMAGE');
  assert.equal(detail.messages[1].fileUrl, doc.body.url);
  assert.equal((await api().post(`/api/disputes/${d.id}/messages`).set(as(a)).send({ text: 'ขอดูหลักฐานเพิ่ม' })).status, 201);

  // ตัดสินแล้วห้ามแนบ/ส่งเพิ่ม แต่ยังดูไฟล์เดิมได้
  const res = await api().put(`/api/admin/disputes/${d.id}/resolve`).set(as(a)).send({ decision: 'REFUND_BUYER', adminNote: 'ตรวจสอบหลักฐานแล้ว' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal((await attach(buyer, 'dispute', d.id, 'late.png', PNG)).status, 400);
  assert.equal((await api().get(doc.body.url).set(as(buyer))).status, 200);
  // ข้อพิพาทที่ตัดสินแล้วเป็นอันจบ ไม่รับข้อความเพิ่ม (กติกาของข้อพิพาท ไม่ใช่สถานะห้องแชต — API ไม่มี chatStatus)
  const after = (await api().get(`/api/disputes/${d.id}`).set(as(buyer))).body;
  assert.equal(after.chatStatus, undefined);
  assert.equal((await api().post(`/api/disputes/${d.id}/messages`).set(as(buyer)).send({ text: 'ยังอยู่ไหม' })).status, 400);
});

test('no close-chat system: rooms have no status, can always send text and files, legacy CLOSED rooms are open again', async () => {
  const seller = await register('seller');
  const buyer = await register('buyer');
  const a = await admin();
  const id = await openDirect(buyer, { sellerId: seller.user.id });
  assert.equal((await send(buyer, id, { text: 'สวัสดีครับ' })).status, 201);

  // มุมมองของทุกฝ่ายไม่มีสถานะห้อง/ข้อมูลการปิด และส่งได้เสมอ
  for (const who of [buyer, seller]) {
    const v = (await read(who, id)).body.conversation;
    assert.equal(v.canSend, true);
    for (const k of ['status', 'closedAt', 'closedBy']) assert.ok(!(k in v), `unexpected ${k}`);
  }
  assert.ok(!('status' in (await list(buyer)).conversations[0]));

  // ไม่มีเส้นทางปิด/เปิดห้อง (ทุกบทบาท) และค่า ?status= ไม่มีผลกับรายการห้องของ Admin
  for (const who of [buyer, seller, a]) {
    assert.equal((await api().put(`/api/chat/conversations/${id}/status`).set(as(who)).send({ status: 'CLOSED' })).status, 404);
  }
  await send(seller, id, { text: 'ยินดีครับ' });
  const sup = (await api().post('/api/chat/support').set(as(buyer)).send({})).body.id;
  await send(buyer, sup, { text: 'ขอความช่วยเหลือ' });
  assert.equal((await list(a, '?status=CLOSED')).conversations.length, 1);

  // ห้องเก่าที่เคยถูกปิดไว้ในฐานข้อมูล (สถานะ CLOSED ที่ค้างจากระบบเดิม) ต้องส่งข้อความ/แนบไฟล์ได้ตามปกติ
  await Conversation.collection.updateOne(
    { _id: new mongoose.Types.ObjectId(id) },
    { $set: { status: 'CLOSED', closedAt: new Date(), closedBySide: 'peer', closedByRole: 'seller' } }
  );
  assert.equal((await send(buyer, id, { text: 'ยังอยู่ไหมครับ' })).status, 201);
  assert.equal((await attach(buyer, 'conversation', id, 'y.png', PNG)).status, 201);
  assert.equal((await read(buyer, id)).body.conversation.canSend, true);

  // งานปรับข้อมูลตอนเริ่มระบบล้างสถานะเก่าออก
  await runMigrations();
  assert.equal((await Conversation.findById(id).lean()).status, undefined);
});

test('chat data model: partial unique indexes keep one DIRECT room per pair and one SUPPORT room per user', async () => {
  const seller = await register('seller');
  const buyer = await register('buyer');
  await Conversation.create({ type: 'DIRECT', ownerId: buyer.user.id, peerId: seller.user.id });
  await assert.rejects(Conversation.create({ type: 'DIRECT', ownerId: buyer.user.id, peerId: seller.user.id }), { code: 11000 });
  await Conversation.create({ type: 'SUPPORT', ownerId: buyer.user.id, isSupportChat: true }); // owner เดียวกันแต่คนละประเภทได้
  await assert.rejects(Conversation.create({ type: 'SUPPORT', ownerId: buyer.user.id, isSupportChat: true }), { code: 11000 });
  const other = await register('seller', 'seller2');
  await Conversation.create({ type: 'DIRECT', ownerId: buyer.user.id, peerId: other.user.id }); // ผู้ซื้อคุยหลายร้านได้

  // เปิดห้องพร้อมกันหลายคำขอ → ได้ห้องเดียว
  const b2 = await register('buyer', 'b2');
  const ids = await Promise.all(
    Array.from({ length: 5 }, () => api().post('/api/chat/conversations').set(as(b2)).send({ sellerId: seller.user.id }))
  );
  assert.ok(ids.every((r) => r.status === 200), JSON.stringify(ids.map((r) => r.body)));
  assert.equal(new Set(ids.map((r) => r.body.id)).size, 1);
});
