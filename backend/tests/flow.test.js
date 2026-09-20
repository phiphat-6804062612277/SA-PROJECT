const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';
process.env.ADMIN_SIGNUP_CODE = 'admin-secret';

const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Dispute = require('../models/Dispute');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const Review = require('../models/Review');
const { trustLevel, trustOf, bayesianScore } = require('../utils/ratings');
const { runImageCleanup } = require('../jobs/imageCleanup');
const Image = require('../models/Image');
const { credit } = require('../utils/wallet');
const { reconcilePayouts } = require('../utils/escrow');
const { runAutoRelease } = require('../jobs/autoRelease');

let mongod;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Order.init(); // สร้าง unique index ของ trackingNumber ให้เสร็จก่อนเริ่มเทสต์
  await Dispute.init();
  await Transaction.init(); // unique {orderId, type}: จ่าย/คืนเงินออเดอร์เดียวกันซ้ำไม่ได้
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
const as = (t) => ({ Authorization: `Bearer ${t.token}` });
async function topup(t, amount) {
  return api().post('/api/wallet/topup').set(as(t)).send({ amount });
}
const admin = () => register('admin', 'admin', { adminCode: 'admin-secret' });
async function newProduct(seller, over = {}) {
  const res = await api()
    .post('/api/products')
    .set(as(seller))
    .send({ name: 'Panel', price: 1000, stock: 5, ...over });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.product;
}
const balance = async (t) => (await api().get('/api/wallet').set(as(t))).body.balance;

test('register validates input, hides admin role, and returns a usable token', async () => {
  assert.equal((await api().post('/api/auth/register').send({ name: 'a', email: 'bad', password: '123456' })).status, 400);
  assert.equal((await api().post('/api/auth/register').send({ name: 'a', email: 'a@t.com', password: '123' })).status, 400);

  // Admin สมัครได้เฉพาะเมื่อมีรหัสลับที่ถูกต้อง
  const noCode = await api().post('/api/auth/register').send({ name: 'x', email: 'x@t.com', password: '123456', role: 'admin' });
  assert.equal(noCode.status, 403);
  const badCode = await api().post('/api/auth/register').send({ name: 'x', email: 'x@t.com', password: '123456', role: 'admin', adminCode: 'nope' });
  assert.equal(badCode.status, 403);
  const admin = await api().post('/api/auth/register').send({ name: 'x', email: 'x@t.com', password: '123456', role: 'admin', adminCode: 'admin-secret' });
  assert.equal(admin.status, 201);
  assert.equal(admin.body.user.role, 'admin');

  const dup = await api().post('/api/auth/register').send({ name: 'x', email: 'X@t.com', password: '123456' });
  assert.equal(dup.status, 400);

  const me = await api().get('/api/auth/me').set({ Authorization: `Bearer ${admin.body.token}` });
  assert.equal(me.status, 200);
  assert.equal(me.body.email, 'x@t.com');
});

test('login works and rejects wrong password; protected route needs token', async () => {
  await register('buyer');
  const ok = await api().post('/api/auth/login').send({ email: 'buyer@t.com', password: '123456' });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.token);
  const bad = await api().post('/api/auth/login').send({ email: 'buyer@t.com', password: 'nope' });
  assert.equal(bad.status, 400);
  assert.equal((await api().get('/api/wallet')).status, 401);
});

test('only sellers can create products; owner-only edit/delete; delete hides product', async () => {
  const seller = await register('seller');
  const other = await register('seller', 'other');
  const buyer = await register('buyer');

  assert.equal((await api().post('/api/products').set(as(buyer)).send({ name: 'x', price: 1, stock: 1 })).status, 403);
  assert.equal((await api().post('/api/products').set(as(seller)).send({ name: 'x', price: -5, stock: 1 })).status, 400);

  const p = await newProduct(seller);
  assert.equal((await api().put(`/api/products/${p._id}`).set(as(other)).send({ price: 1 })).status, 404);
  const upd = await api().put(`/api/products/${p._id}`).set(as(seller)).send({ price: 1200 });
  assert.equal(upd.body.product.price, 1200);

  const list = await api().get('/api/products?q=pan');
  assert.equal(list.body.length, 1);
  const detail = await api().get(`/api/products/${p._id}`);
  assert.equal(detail.body.seller.name, 'seller');

  await api().delete(`/api/products/${p._id}`).set(as(seller));
  assert.equal((await api().get('/api/products')).body.length, 0);
  assert.equal((await api().get(`/api/products/${p._id}`)).status, 404);
  assert.equal((await api().get('/api/products/not-an-id')).status, 404);
});

test('cart: add/merge/update/remove, capped by stock, cannot buy own product', async () => {
  const seller = await register('seller');
  const buyer = await register('buyer');
  const p = await newProduct(seller, { stock: 3 });

  await api().post('/api/cart').set(as(buyer)).send({ productId: p._id, quantity: 2 });
  const merged = await api().post('/api/cart').set(as(buyer)).send({ productId: p._id, quantity: 5 });
  assert.equal(merged.body.items.length, 1);
  assert.equal(merged.body.items[0].quantity, 3); // capped at stock
  assert.equal(merged.body.items[0].product.name, 'Panel');

  const put = await api().put(`/api/cart/${p._id}`).set(as(buyer)).send({ quantity: 1 });
  assert.equal(put.body.items[0].quantity, 1);

  const del = await api().delete(`/api/cart/${p._id}`).set(as(buyer));
  assert.equal(del.body.items.length, 0);

  assert.equal((await api().post('/api/cart').set(as(seller)).send({ productId: p._id })).status, 403);
});

test('full escrow flow: pay → hold → ship → confirm → seller paid', async () => {
  const seller = await register('seller');
  const buyer = await register('buyer');
  const p = await newProduct(seller, { price: 1000, stock: 5 });
  await topup(buyer, 5000);

  await api().post('/api/cart').set(as(buyer)).send({ productId: p._id, quantity: 2 });
  const co = await api().post('/api/orders/checkout').set(as(buyer)).send({ shippingAddress: '9 Ship St' });
  assert.equal(co.status, 201, JSON.stringify(co.body));
  assert.equal(co.body.orders.length, 1);
  const order = co.body.orders[0];
  assert.equal(order.totalAmount, 2000);
  assert.equal(order.escrowStatus, 'HELD');
  assert.equal(order.shippingAddress, '9 Ship St');

  // เงินผู้ซื้อลด, เงินผู้ขายยังไม่เข้า (ถูกถือไว้), สต็อกลด, ตะกร้าว่าง
  assert.equal(await balance(buyer), 3000);
  assert.equal(await balance(seller), 0);
  assert.equal((await api().get(`/api/products/${p._id}`)).body.stock, 3);
  assert.equal((await api().get('/api/cart').set(as(buyer))).body.items.length, 0);

  // ผู้ซื้อยืนยันรับก่อนจัดส่งไม่ได้
  assert.equal((await api().put(`/api/orders/${order._id}/complete`).set(as(buyer))).status, 400);
  // ผู้ซื้อสั่ง ship ไม่ได้
  assert.equal((await api().put(`/api/orders/${order._id}/ship`).set(as(buyer)).send({ trackingNumber: 'X' })).status, 403);
  // ต้องมีเลขพัสดุ
  assert.equal((await api().put(`/api/orders/${order._id}/ship`).set(as(seller)).send({})).status, 400);

  const shipped = await api().put(`/api/orders/${order._id}/ship`).set(as(seller)).send({ trackingNumber: 'TH12345678' });
  assert.equal(shipped.body.order.status, 'SHIPPED');

  // จัดส่งแล้วยกเลิกไม่ได้
  assert.equal((await api().put(`/api/orders/${order._id}/cancel`).set(as(buyer))).status, 400);

  const done = await api().put(`/api/orders/${order._id}/complete`).set(as(buyer));
  assert.equal(done.body.order.status, 'COMPLETED');
  assert.equal(done.body.order.escrowStatus, 'RELEASED');
  assert.equal(await balance(seller), 2000);

  // กดซ้ำไม่จ่ายเงินซ้ำ
  assert.equal((await api().put(`/api/orders/${order._id}/complete`).set(as(buyer))).status, 400);
  assert.equal(await balance(seller), 2000);

  const w = await api().get('/api/wallet').set(as(seller));
  assert.equal(w.body.transactions[0].type, 'RECEIVE_PAYMENT');

  assert.equal((await api().get('/api/orders/mine').set(as(buyer))).body[0].status, 'COMPLETED');
  assert.equal((await api().get('/api/orders/selling').set(as(seller))).body[0].buyerId.name, 'buyer');
});

test('checkout ignores client prices, splits orders by seller, respects selected items', async () => {
  const s1 = await register('seller', 's1');
  const s2 = await register('seller', 's2');
  const buyer = await register('buyer');
  const a = await newProduct(s1, { name: 'A', price: 100 });
  const b = await newProduct(s2, { name: 'B', price: 300 });
  const c = await newProduct(s2, { name: 'C', price: 500 });
  await topup(buyer, 10000);
  for (const p of [a, b, c]) await api().post('/api/cart').set(as(buyer)).send({ productId: p._id });

  const co = await api()
    .post('/api/orders/checkout')
    .set(as(buyer))
    .send({ productIds: [a._id, b._id], totalAmount: 1, items: [{ price: 1 }] });
  assert.equal(co.status, 201);
  assert.equal(co.body.orders.length, 2);
  assert.equal(await balance(buyer), 10000 - 400);
  // C ที่ไม่ได้เลือกยังค้างในตะกร้า
  const cart = await api().get('/api/cart').set(as(buyer));
  assert.deepEqual(cart.body.items.map((i) => i.product.name), ['C']);
});

test('checkout rejects insufficient balance / stock / missing address without side effects', async () => {
  const seller = await register('seller');
  const buyer = await register('buyer');
  const p = await newProduct(seller, { price: 1000, stock: 2 });
  await api().post('/api/cart').set(as(buyer)).send({ productId: p._id, quantity: 2 });

  const poor = await api().post('/api/orders/checkout').set(as(buyer)).send({});
  assert.equal(poor.status, 400);
  assert.match(poor.body.message, /ไม่เพียงพอ/);
  assert.equal((await api().get(`/api/products/${p._id}`)).body.stock, 2);

  await topup(buyer, 5000);
  await Product.updateOne({ _id: p._id }, { stock: 1 }); // มีคนซื้อตัดหน้า
  const low = await api().post('/api/orders/checkout').set(as(buyer)).send({});
  assert.equal(low.status, 400);
  assert.equal(await balance(buyer), 5000);

  await Product.updateOne({ _id: p._id }, { stock: 5 });
  // ผู้ใช้ที่ไม่มีที่อยู่ในโปรไฟล์และไม่ส่งมา
  const noAddr = await register('buyer', 'noaddr');
  await api().put('/api/auth/profile').set(as(noAddr)).send({ address: '' });
  await api().post('/api/cart').set(as(noAddr)).send({ productId: p._id });
  await topup(noAddr, 2000);
  assert.equal((await api().post('/api/orders/checkout').set(as(noAddr)).send({})).status, 400);
});

test('concurrent checkouts cannot oversell stock or overdraw wallet', async () => {
  const seller = await register('seller');
  const p = await newProduct(seller, { price: 100, stock: 1 });
  const buyers = [];
  for (let i = 0; i < 4; i++) {
    const b = await register('buyer', `b${i}`);
    await topup(b, 1000);
    await api().post('/api/cart').set(as(b)).send({ productId: p._id });
    buyers.push(b);
  }
  const results = await Promise.all(buyers.map((b) => api().post('/api/orders/checkout').set(as(b)).send({})));
  assert.equal(results.filter((r) => r.status === 201).length, 1);
  assert.equal((await api().get(`/api/products/${p._id}`)).body.stock, 0);
  // คนที่ซื้อไม่ได้ต้องได้เงินคืนครบ
  const bals = await Promise.all(buyers.map(balance));
  assert.deepEqual(bals.sort((x, y) => x - y), [900, 1000, 1000, 1000]);
});

test('cancel before shipping refunds buyer and restores stock (buyer or seller)', async () => {
  const seller = await register('seller');
  const buyer = await register('buyer');
  const p = await newProduct(seller, { price: 500, stock: 4 });
  await topup(buyer, 2000);

  async function place() {
    await api().post('/api/cart').set(as(buyer)).send({ productId: p._id, quantity: 2 });
    return (await api().post('/api/orders/checkout').set(as(buyer)).send({})).body.orders[0];
  }

  const o1 = await place();
  assert.equal(await balance(buyer), 1000);
  const c1 = await api().put(`/api/orders/${o1._id}/cancel`).set(as(buyer));
  assert.equal(c1.body.order.status, 'CANCELLED');
  assert.equal(c1.body.order.escrowStatus, 'REFUNDED');
  assert.equal(await balance(buyer), 2000);
  assert.equal((await api().get(`/api/products/${p._id}`)).body.stock, 4);
  // ยกเลิกซ้ำไม่คืนเงินซ้ำ
  assert.equal((await api().put(`/api/orders/${o1._id}/cancel`).set(as(buyer))).status, 400);
  assert.equal(await balance(buyer), 2000);

  const o2 = await place();
  const c2 = await api().put(`/api/orders/${o2._id}/cancel`).set(as(seller));
  assert.equal(c2.body.order.cancelledBy, 'seller');
  assert.equal(await balance(buyer), 2000);

  // คนอื่นยกเลิกออเดอร์ของเราไม่ได้
  const stranger = await register('buyer', 'stranger');
  const o3 = await place();
  assert.equal((await api().put(`/api/orders/${o3._id}/cancel`).set(as(stranger))).status, 403);
});

test('wallet: buyers top up (limited), sellers cannot top up, only sellers withdraw', async () => {
  const buyer = await register('buyer');
  const seller = await register('seller');

  assert.equal((await topup(buyer, 0)).status, 400);
  assert.equal((await topup(buyer, 1e9)).status, 400);
  assert.equal((await topup(buyer, 1000)).body.balance, 1000);

  // ผู้ขายเติมเงินไม่ได้ / ผู้ซื้อถอนเงินไม่ได้
  assert.equal((await topup(seller, 500)).status, 403);
  assert.equal((await api().post('/api/wallet/withdraw').set(as(buyer)).send({ amount: 100 })).status, 403);

  // ผู้ขายได้เงินจากการขาย แล้วถอนได้ไม่เกินยอดคงเหลือ
  const p = await newProduct(seller, { price: 1000, stock: 1 });
  await api().post('/api/cart').set(as(buyer)).send({ productId: p._id });
  const order = (await api().post('/api/orders/checkout').set(as(buyer)).send({})).body.orders[0];
  await api().put(`/api/orders/${order._id}/ship`).set(as(seller)).send({ trackingNumber: 'TRK00001' });
  await api().put(`/api/orders/${order._id}/complete`).set(as(buyer));
  assert.equal(await balance(seller), 1000);

  assert.equal((await api().post('/api/wallet/withdraw').set(as(seller)).send({ amount: 5000 })).status, 400);
  const w = await api().post('/api/wallet/withdraw').set(as(seller)).send({ amount: 400 });
  assert.equal(w.body.balance, 600);
  const tx = (await api().get('/api/wallet').set(as(seller))).body.transactions;
  assert.equal(tx[0].type, 'WITHDRAW');
  assert.ok(tx[0].description);
});

test('phone numbers are validated and normalised (register + profile)', async () => {
  const ok = await api().post('/api/auth/register').send({ name: 'p', email: 'p@t.com', password: '123456', phone: '081-234-5678' });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.user.phone, '0812345678');

  const bad = await api().post('/api/auth/register').send({ name: 'q', email: 'q@t.com', password: '123456', phone: '12345' });
  assert.equal(bad.status, 400);
  assert.match(bad.body.message, /เบอร์โทรศัพท์/);

  const auth = { Authorization: `Bearer ${ok.body.token}` };
  const upd = await api().put('/api/auth/profile').set(auth).send({ phone: '+66 81 234 5678' });
  assert.equal(upd.body.user.phone, '0812345678');
  assert.equal((await api().put('/api/auth/profile').set(auth).send({ phone: '0112345678' })).status, 400);
  // เว้นว่างได้ (ไม่บังคับ)
  assert.equal((await api().put('/api/auth/profile').set(auth).send({ phone: '' })).body.user.phone, '');
});

test('product name <= 100 and description <= 1000 characters', async () => {
  const seller = await register('seller');
  const post = (body) => api().post('/api/products').set(as(seller)).send({ price: 10, stock: 1, ...body });

  assert.equal((await post({ name: 'x'.repeat(101) })).status, 400);
  assert.equal((await post({ name: 'ok', description: 'y'.repeat(1001) })).status, 400);
  assert.equal((await post({ name: 'x'.repeat(100), description: 'y'.repeat(1000) })).status, 201);
  const p = (await post({ name: 'edit me' })).body.product;
  assert.equal((await api().put(`/api/products/${p._id}`).set(as(seller)).send({ description: 'z'.repeat(1001) })).status, 400);
});

test('store: default name, rename, in-store vs outside-store products', async () => {
  const seller = await register('seller', 'shopper');
  const inside = await newProduct(seller, { name: 'Inside', inStore: true });
  const outside = await newProduct(seller, { name: 'Outside', inStore: false });

  const me = await api().get('/api/auth/me').set(as(seller));
  assert.equal(me.body.storeName, 'shopper'); // ชื่อร้านเริ่มต้น = ชื่อผู้ใช้

  const upd = await api().put('/api/stores/me').set(as(seller)).send({ storeName: 'Sunny Store', storeDescription: 'best panels' });
  assert.equal(upd.body.user.storeName, 'Sunny Store');
  assert.equal((await api().put('/api/stores/me').set(as(seller)).send({ storeName: 'x'.repeat(61) })).status, 400);
  assert.equal((await api().put('/api/stores/me').set(as(await register('buyer'))).send({ storeName: 'hack' })).status, 403);

  const store = await api().get(`/api/stores/${upd.body.user.id}`);
  assert.equal(store.body.store.name, 'Sunny Store');
  assert.deepEqual(store.body.products.map((x) => x.name), ['Inside']); // นอกร้านไม่โผล่ในหน้าร้าน

  const market = await api().get('/api/products');
  assert.deepEqual(market.body.map((x) => x.name).sort(), ['Inside', 'Outside']); // แต่ยังขายในตลาดรวม

  // สลับตำแหน่งสินค้า
  await api().put(`/api/products/${outside._id}`).set(as(seller)).send({ inStore: true });
  assert.equal((await api().get(`/api/stores/${upd.body.user.id}`)).body.products.length, 2);
  assert.ok(inside._id);
});

test('reviews: only after completion, once per side, feeds product/store ratings', async () => {
  const seller = await register('seller');
  const buyer = await register('buyer');
  const p = await newProduct(seller, { price: 100, stock: 3 });
  await topup(buyer, 1000);
  await api().post('/api/cart').set(as(buyer)).send({ productId: p._id });
  const order = (await api().post('/api/orders/checkout').set(as(buyer)).send({})).body.orders[0];

  const review = (who, body) => api().post('/api/reviews').set(as(who)).send({ orderId: order._id, ...body });
  assert.equal((await review(buyer, { rating: 5 })).status, 400); // ยังไม่สำเร็จ

  await api().put(`/api/orders/${order._id}/ship`).set(as(seller)).send({ trackingNumber: 'TRK00002' });
  await api().put(`/api/orders/${order._id}/complete`).set(as(buyer));

  assert.equal((await review(buyer, { rating: 0 })).status, 400);
  assert.equal((await review(buyer, { rating: 6 })).status, 400);
  assert.equal((await review(buyer, { rating: 5, comment: 'x'.repeat(501) })).status, 400);
  assert.equal((await review(await register('buyer', 'stranger'), { rating: 5 })).status, 403);

  assert.equal((await review(buyer, { rating: 4, comment: 'ส่งไว' })).status, 201);
  assert.equal((await review(buyer, { rating: 5 })).status, 400); // รีวิวซ้ำไม่ได้
  assert.equal((await review(seller, { rating: 2, comment: 'ตอบช้า' })).status, 201); // ผู้ขายรีวิวผู้ซื้อ

  const prod = await api().get(`/api/reviews/product/${p._id}`);
  assert.equal(prod.body.rating.avg, 4);
  assert.equal(prod.body.reviews[0].comment, 'ส่งไว');
  assert.equal((await api().get(`/api/products/${p._id}`)).body.rating.count, 1);
  assert.equal((await api().get(`/api/reviews/seller/${seller.user.id}`)).body.rating.avg, 4);

  // ฝั่งผู้ซื้อเห็นรีวิวที่ผู้ขายให้, ผู้ขายเห็นคะแนนผู้ซื้อในออเดอร์
  assert.equal((await api().get('/api/reviews/received').set(as(buyer))).body.rating.avg, 2);
  const mine = (await api().get('/api/orders/mine').set(as(buyer))).body[0];
  assert.equal(mine.myReview.rating, 4);
  assert.equal(mine.reviewOfMe.rating, 2);
  const selling = (await api().get('/api/orders/selling').set(as(seller))).body[0];
  assert.equal(selling.buyerRating.avg, 2);
});

test('admin: only admins can use /api/admin; ban blocks login and existing tokens', async () => {
  const buyer = await register('buyer');
  const a = await admin();

  assert.equal((await api().get('/api/admin/users').set(as(buyer))).status, 403);
  assert.equal((await api().get('/api/admin/users')).status, 401);

  const users = await api().get('/api/admin/users').set(as(a));
  assert.equal(users.body.length, 1); // ไม่แสดง Admin ในรายการ
  assert.equal(users.body[0].email, 'buyer@t.com');

  const ban = await api().put(`/api/admin/users/${buyer.user.id}/ban`).set(as(a)).send({ reason: 'spam' });
  assert.equal(ban.body.user.isBanned, true);

  // token เดิมใช้ไม่ได้ทันที + ล็อกอินใหม่ไม่ได้
  const old = await api().get('/api/wallet').set(as(buyer));
  assert.equal(old.status, 403);
  assert.equal(old.body.code, 'BANNED');
  assert.match(old.body.message, /spam/);
  const login = await api().post('/api/auth/login').send({ email: 'buyer@t.com', password: '123456' });
  assert.equal(login.status, 403);
  assert.equal(login.body.code, 'BANNED');

  await api().put(`/api/admin/users/${buyer.user.id}/unban`).set(as(a));
  assert.equal((await api().get('/api/wallet').set(as(buyer))).status, 200);

  // ห้ามแบน Admin / ตัวเอง
  assert.equal((await api().put(`/api/admin/users/${a.user.id}/ban`).set(as(a)).send({})).status, 400);
});

test('admin: banning a seller or a store hides products and blocks selling; unban restores', async () => {
  const seller = await register('seller');
  const buyer = await register('buyer');
  const a = await admin();
  const p = await newProduct(seller);
  await api().post('/api/cart').set(as(buyer)).send({ productId: p._id });
  await topup(buyer, 5000);

  // แบนร้าน: สินค้าถูกซ่อน, ตะกร้าไม่เห็น, ซื้อไม่ได้, ลงขายเพิ่มไม่ได้ แต่ผู้ขายยังล็อกอินได้
  await api().put(`/api/admin/stores/${seller.user.id}/ban`).set(as(a)).send({ reason: 'fake goods' });
  assert.equal((await api().get('/api/products')).body.length, 0);
  assert.equal((await api().get(`/api/products/${p._id}`)).status, 404);
  assert.equal((await api().get(`/api/stores/${seller.user.id}`)).status, 404);
  assert.equal((await api().get('/api/cart').set(as(buyer))).body.items.length, 0);
  assert.equal((await api().post('/api/orders/checkout').set(as(buyer)).send({})).status, 400);
  assert.equal((await api().post('/api/products').set(as(seller)).send({ name: 'new', price: 1, stock: 1 })).status, 403);
  assert.equal((await api().get('/api/wallet').set(as(seller))).status, 200);

  await api().put(`/api/admin/stores/${seller.user.id}/unban`).set(as(a));
  assert.equal((await api().get('/api/products')).body.length, 1);

  // แบนบัญชีผู้ขาย: สินค้าซ่อนเช่นกัน และปลดแบนแล้วกลับมา (ไม่ปลดถ้าร้านยังถูกแบนอยู่)
  await api().put(`/api/admin/stores/${seller.user.id}/ban`).set(as(a)).send({});
  await api().put(`/api/admin/users/${seller.user.id}/ban`).set(as(a)).send({});
  await api().put(`/api/admin/users/${seller.user.id}/unban`).set(as(a));
  assert.equal((await api().get('/api/products')).body.length, 0); // ร้านยังโดนแบน
  await api().put(`/api/admin/stores/${seller.user.id}/unban`).set(as(a));
  assert.equal((await api().get('/api/products')).body.length, 1);

  // ผู้ซื้อใช้ /stores ban ไม่ได้ (เฉพาะผู้ขาย)
  assert.equal((await api().put(`/api/admin/stores/${buyer.user.id}/ban`).set(as(a)).send({})).status, 400);
});

test('admin: delete product hides it everywhere; order history stays', async () => {
  const seller = await register('seller');
  const buyer = await register('buyer');
  const a = await admin();
  const p = await newProduct(seller, { price: 100 });
  await topup(buyer, 1000);
  await api().post('/api/cart').set(as(buyer)).send({ productId: p._id });
  await api().post('/api/orders/checkout').set(as(buyer)).send({});

  assert.equal((await api().get('/api/admin/products').set(as(a))).body.length, 1);
  assert.equal((await api().delete(`/api/admin/products/${p._id}`).set(as(seller))).status, 403);
  assert.equal((await api().delete(`/api/admin/products/${p._id}`).set(as(a))).status, 200);
  assert.equal((await api().get('/api/products')).body.length, 0);
  assert.equal((await api().get('/api/orders/mine').set(as(buyer))).body[0].items[0].name, 'Panel');
});

test('forgot password: OTP → reset token → new password (single use, limited attempts)', async () => {
  await register('buyer', 'forgetful');
  const req = (path, body) => api().post(`/api/auth/${path}`).send(body);
  const email = 'forgetful@t.com';

  // อีเมลที่ไม่มีในระบบ: ตอบเหมือนกัน (ไม่เปิดเผย) และไม่มี OTP
  const unknown = await req('forgot-password', { email: 'nobody@t.com' });
  assert.equal(unknown.status, 200);
  assert.equal(unknown.body.demoOtp, undefined);

  const sent = await req('forgot-password', { email });
  assert.equal(sent.status, 200);
  assert.match(sent.body.demoOtp, /^\d{5}$/); // โหมดสาธิตเปิดตอนไม่ใช่ production
  assert.equal((await req('forgot-password', { email })).status, 429); // ขอถี่เกินไป

  // OTP ผิด
  const wrong = sent.body.demoOtp === '00000' ? '11111' : '00000';
  const bad = await req('verify-otp', { email, otp: wrong });
  assert.equal(bad.status, 400);
  assert.match(bad.body.message, /เหลืออีก 4/);

  const ok = await req('verify-otp', { email, otp: sent.body.demoOtp });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.resetToken);
  // OTP ใช้ซ้ำไม่ได้
  assert.equal((await req('verify-otp', { email, otp: sent.body.demoOtp })).status, 400);

  // ตั้งรหัสผ่านใหม่
  assert.equal((await req('reset-password', { resetToken: ok.body.resetToken, password: '123' })).status, 400);
  assert.equal((await req('reset-password', { resetToken: 'garbage', password: 'newpass1' })).status, 400);
  assert.equal((await req('reset-password', { resetToken: ok.body.resetToken, password: 'newpass1' })).status, 200);
  // โทเคนใช้ซ้ำไม่ได้
  assert.equal((await req('reset-password', { resetToken: ok.body.resetToken, password: 'another1' })).status, 400);

  assert.equal((await req('login', { email, password: '123456' })).status, 400);
  assert.equal((await req('login', { email, password: 'newpass1' })).status, 200);
});

test('forgot password: too many wrong OTP attempts locks the code; reset token is not a login token', async () => {
  await register('buyer', 'locky');
  const email = 'locky@t.com';
  const req = (path, body) => api().post(`/api/auth/${path}`).send(body);
  const sent = await req('forgot-password', { email });
  const wrong = sent.body.demoOtp === '00000' ? '11111' : '00000';

  for (let i = 0; i < 5; i++) assert.equal((await req('verify-otp', { email, otp: wrong })).status, 400);
  // ครบ 5 ครั้งแล้ว แม้กรอกถูกก็ต้องขอใหม่
  assert.equal((await req('verify-otp', { email, otp: sent.body.demoOtp })).status, 429);

  // โทเคนรีเซ็ตรหัสผ่านต้องใช้เป็น Bearer token ล็อกอินไม่ได้
  const jwt = require('jsonwebtoken');
  const fake = jwt.sign({ email, nonce: 'x', purpose: 'reset', id: '000000000000000000000000' }, 'test-secret');
  assert.equal((await api().get('/api/auth/me').set({ Authorization: `Bearer ${fake}` })).status, 401);
});


// ===================================================================== ราคา/สต็อกสูงสุด
test('product price/stock have sane upper limits; absurd legacy prices are hidden from the market', async () => {
  const seller = await register('seller');
  const post = (body) => api().post('/api/products').set(as(seller)).send({ name: 'P', stock: 1, price: 100, ...body });

  assert.equal((await post({ price: 1e21 })).status, 400);
  assert.equal((await post({ price: 10000001 })).status, 400);
  assert.equal((await post({ price: 99.999 })).status, 400); // ทศนิยมเกิน 2 ตำแหน่ง
  assert.equal((await post({ stock: 100001 })).status, 400);
  assert.equal((await post({ price: 10000000, stock: 100000 })).status, 201);
  const ok = await post({ price: 99.5 });
  assert.equal(ok.body.product.price, 99.5);

  // ข้อมูลเก่าที่ราคาผิดปกติ (เช่นที่หลุดเข้ามาก่อนมีเพดาน) ต้องไม่โผล่ในตลาด และซื้อไม่ได้
  const bad = await Product.collection.insertOne({
    sellerId: new mongoose.Types.ObjectId(seller.user.id),
    name: 'แฟนผม',
    price: 1e21,
    stock: 1,
    isActive: true,
    suspended: false,
    inStore: true,
  });
  const list = (await api().get('/api/products')).body;
  assert.ok(!list.some((p) => String(p._id) === String(bad.insertedId)));
  assert.equal((await api().get(`/api/products/${bad.insertedId}`)).status, 404);

  const buyer = await register('buyer');
  await topup(buyer, 1000);
  const add = await api().post('/api/cart').set(as(buyer)).send({ productId: String(bad.insertedId) });
  assert.ok(add.status >= 400);
});

// ===================================================================== เลขพัสดุ / Auto-Release
async function placeOrder(seller, buyer, { price = 1000, stock = 5 } = {}) {
  const p = await newProduct(seller, { price, stock });
  await api().post('/api/cart').set(as(buyer)).send({ productId: p._id, quantity: 1 });
  const co = await api().post('/api/orders/checkout').set(as(buyer)).send({ shippingAddress: '9 Ship St' });
  assert.equal(co.status, 201, JSON.stringify(co.body));
  return co.body.orders[0];
}
const ship = (seller, order, trackingNumber) =>
  api().put(`/api/orders/${order._id}/ship`).set(as(seller)).send({ trackingNumber });
async function shippedOrder(seller, buyer, tracking, opts) {
  const order = await placeOrder(seller, buyer, opts);
  const r = await ship(seller, order, tracking);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body.order;
}

test('tracking number: validated, normalized, unique, immutable; ship sets shippedAt/autoReleaseAt (+7 days)', async () => {
  const seller = await register('seller');
  const buyer = await register('buyer');
  await topup(buyer, 50000);
  const o1 = await placeOrder(seller, buyer);
  const o2 = await placeOrder(seller, buyer);

  for (const bad of ['', '12', 'ก็ไก่1234567', 'A'.repeat(31), 'TH-12 34!5678']) {
    assert.equal((await ship(seller, o1, bad)).status, 400, `should reject ${bad}`);
  }

  const before = Date.now();
  const r = await ship(seller, o1, ' th-1234 5678 ');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.order.status, 'SHIPPED');
  assert.equal(r.body.order.trackingNumber, 'TH12345678'); // ตัดช่องว่าง/ขีด + ตัวพิมพ์ใหญ่
  const shippedAt = new Date(r.body.order.shippedAt).getTime();
  const autoAt = new Date(r.body.order.autoReleaseAt).getTime();
  assert.ok(shippedAt >= before - 1000);
  assert.ok(Math.abs(autoAt - shippedAt - 7 * 24 * 3600 * 1000) < 1000);

  // ใช้เลขซ้ำกับออเดอร์อื่นไม่ได้ (แม้พิมพ์คนละรูปแบบ) และออเดอร์ที่ถูกปฏิเสธยังเป็น PENDING_SHIPMENT
  const dup = await ship(seller, o2, 'th12345678');
  assert.equal(dup.status, 409);
  assert.equal((await Order.findById(o2._id)).status, 'PENDING_SHIPMENT');

  // ห้ามแก้เลขพัสดุหลังบันทึก
  const edit = await ship(seller, o1, 'TH99999999');
  assert.equal(edit.status, 400);
  assert.equal((await Order.findById(o1._id)).trackingNumber, 'TH12345678');

  // ผู้ขายคนอื่นทำแทนไม่ได้
  const other = await register('seller', 'seller2');
  assert.equal((await ship(other, o2, 'TH55555555')).status, 403);

  // เลขใหม่ใช้ได้
  assert.equal((await ship(seller, o2, 'TH55555555')).status, 200);
});

test('unique index rejects duplicate tracking numbers even if the app-level check is bypassed', async () => {
  const seller = await register('seller');
  const buyer = await register('buyer');
  await topup(buyer, 50000);
  const a = await placeOrder(seller, buyer);
  const b = await placeOrder(seller, buyer);
  await Order.updateOne({ _id: a._id }, { trackingNumber: 'DUP123456' });
  await assert.rejects(Order.updateOne({ _id: b._id }, { trackingNumber: 'DUP123456' }), (e) => e.code === 11000);
  // ออเดอร์ที่ยังไม่มีเลขพัสดุ (ค่าว่าง) ซ้ำกันได้
  assert.equal(await Order.countDocuments({ trackingNumber: '' }), 1); // b ยังไม่มีเลขพัสดุ (ค่าว่างซ้ำกันได้)
});

test('auto-release worker: pays due SHIPPED orders once, skips not-due and DISPUTED, logs AUTO_RELEASE', async () => {
  const seller = await register('seller');
  const buyer = await register('buyer');
  await topup(buyer, 50000);
  const due = await shippedOrder(seller, buyer, 'AUTO00001');
  const notDue = await shippedOrder(seller, buyer, 'AUTO00002');
  const disputed = await shippedOrder(seller, buyer, 'AUTO00003');

  // ผู้ซื้อเปิดข้อพิพาทออเดอร์ที่ 3 → ต้องไม่ถูกปล่อยเงิน
  const d = await api().post('/api/disputes').set(as(buyer)).send({ orderId: disputed._id, reason: 'สินค้าไม่ตรงปก ผิดรุ่น' });
  assert.equal(d.status, 201, JSON.stringify(d.body));

  await Order.updateOne({ _id: due._id }, { autoReleaseAt: new Date(Date.now() - 1000) });

  const paidBefore = await balance(seller);
  assert.equal(paidBefore, 0);
  const run = await runAutoRelease();
  assert.equal(run.released, 1);
  assert.equal(await balance(seller), 1000);

  const o = await Order.findById(due._id);
  assert.equal(o.status, 'COMPLETED');
  assert.equal(o.escrowStatus, 'RELEASED');
  assert.equal(o.releasedBy, 'auto');
  assert.equal((await Order.findById(notDue._id)).status, 'SHIPPED');
  assert.equal((await Order.findById(disputed._id)).status, 'DISPUTED');

  const tx = (await api().get('/api/wallet').set(as(seller))).body.transactions;
  assert.equal(tx[0].type, 'AUTO_RELEASE');
  assert.equal(String(tx[0].referenceOrderId), String(due._id));

  // รันซ้ำไม่จ่ายซ้ำ + ผู้ซื้อกดยืนยันหลัง auto-release ไม่จ่ายซ้ำ
  assert.equal((await runAutoRelease()).released, 0);
  assert.equal((await api().put(`/api/orders/${due._id}/complete`).set(as(buyer))).status, 400);
  assert.equal(await balance(seller), 1000);

  // อนาคตไกลๆ: ออเดอร์ที่ SHIPPED ครบกำหนดจึงถูกปล่อย แต่ DISPUTED ยังถูก Freeze
  const later = await runAutoRelease({ now: new Date(Date.now() + 30 * 24 * 3600 * 1000) });
  assert.equal(later.released, 1);
  assert.equal(await balance(seller), 2000);
  assert.equal((await Order.findById(disputed._id)).status, 'DISPUTED');
});

test('auto-release worker and buyer confirmation racing never pay the seller twice', async () => {
  const seller = await register('seller');
  const buyer = await register('buyer');
  await topup(buyer, 5000);
  const o = await shippedOrder(seller, buyer, 'RACE00001');
  await Order.updateOne({ _id: o._id }, { autoReleaseAt: new Date(Date.now() - 1000) });

  await Promise.all([
    runAutoRelease(),
    api().put(`/api/orders/${o._id}/complete`).set(as(buyer)),
    runAutoRelease(),
  ]);
  assert.equal(await balance(seller), 1000);
  assert.equal(await Order.countDocuments({ status: 'COMPLETED' }), 1);
});

test('auto-release backfills legacy SHIPPED orders that have no autoReleaseAt', async () => {
  const seller = await register('seller');
  const buyer = await register('buyer');
  await topup(buyer, 5000);
  const o = await shippedOrder(seller, buyer, 'LEGACY001');
  const eightDaysAgo = new Date(Date.now() - 8 * 24 * 3600 * 1000);
  await Order.updateOne({ _id: o._id }, { shippedAt: eightDaysAgo, autoReleaseAt: null });
  const run = await runAutoRelease();
  assert.equal(run.released, 1);
  assert.equal(await balance(seller), 1000);
});

// ===================================================================== Dispute (ผู้ซื้อ)
test('buyer dispute: only SHIPPED, validates input, freezes escrow and stops auto-release', async () => {
  const seller = await register('seller');
  const buyer = await register('buyer');
  await topup(buyer, 50000);
  const pending = await placeOrder(seller, buyer);
  const dispute = (who, body) => api().post('/api/disputes').set(as(who)).send(body);

  // ยังไม่จัดส่ง → เปิดไม่ได้
  const early = await dispute(buyer, { orderId: pending._id, reason: 'ยังไม่ได้รับสินค้าเลย' });
  assert.equal(early.status, 400);

  const o = (await ship(seller, pending, 'DSP000001')).body.order;
  assert.ok(o.autoReleaseAt);

  // validation
  assert.equal((await dispute(buyer, { orderId: o._id, reason: 'สั้น' })).status, 400);
  assert.equal((await dispute(buyer, { orderId: o._id, reason: 'x'.repeat(1001) })).status, 400);
  assert.equal((await dispute(buyer, { orderId: o._id, reason: 'สินค้าไม่ตรงปก', evidenceImages: ['ftp://x/y.png'] })).status, 400);
  assert.equal((await dispute(buyer, { orderId: o._id, reason: 'สินค้าไม่ตรงปก', evidenceImages: ['not a url'] })).status, 400);
  assert.equal(
    (await dispute(buyer, { orderId: o._id, reason: 'สินค้าไม่ตรงปก', evidenceImages: Array.from({ length: 6 }, (_, i) => `https://x.com/${i}.png`) })).status,
    400
  );
  assert.equal((await dispute(buyer, { orderId: 'zzz', reason: 'สินค้าไม่ตรงปก' })).status, 404);
  // ผู้ขาย / คนอื่นเปิดไม่ได้
  assert.equal((await dispute(seller, { orderId: o._id, reason: 'สินค้าไม่ตรงปก' })).status, 403);
  assert.equal((await dispute(await register('buyer', 'stranger'), { orderId: o._id, reason: 'สินค้าไม่ตรงปก' })).status, 403);
  assert.equal((await Order.findById(o._id)).status, 'SHIPPED'); // ทุกอย่างข้างบนต้องไม่กระทบออเดอร์

  const ok = await dispute(buyer, {
    orderId: o._id,
    reason: 'ได้รับกล่องเปล่า ไม่มีสินค้าข้างใน',
    evidenceImages: ['https://img.example.com/a.png', 'https://img.example.com/a.png', 'http://img.example.com/b.jpg'],
  });
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  assert.equal(ok.body.dispute.status, 'PENDING');
  assert.equal(ok.body.dispute.evidenceImages.length, 2); // ตัดลิงก์ซ้ำ
  assert.equal(ok.body.dispute.amount, 1000);

  const frozen = await Order.findById(o._id);
  assert.equal(frozen.status, 'DISPUTED');
  assert.equal(frozen.escrowStatus, 'HELD'); // เงินยังถูกถือไว้ (Freeze)
  assert.equal(frozen.autoReleaseAt, null);
  assert.ok(frozen.disputedAt);
  assert.equal(String(frozen.disputeId), String(ok.body.dispute.id));

  // Freeze: ผู้ซื้อยืนยันรับ/ยกเลิกไม่ได้ Worker ไม่ปล่อยเงิน และเปิดซ้ำไม่ได้
  assert.equal((await api().put(`/api/orders/${o._id}/complete`).set(as(buyer))).status, 400);
  assert.equal((await api().put(`/api/orders/${o._id}/cancel`).set(as(buyer))).status, 400);
  assert.equal((await runAutoRelease({ now: new Date(Date.now() + 90 * 24 * 3600 * 1000) })).released, 0);
  assert.equal((await dispute(buyer, { orderId: o._id, reason: 'เปิดซ้ำอีกรอบ' })).status, 409);
  assert.equal(await balance(seller), 0);
});

test('buyer cannot open a dispute after the auto-release deadline has passed', async () => {
  const seller = await register('seller');
  const buyer = await register('buyer');
  await topup(buyer, 5000);
  const o = await shippedOrder(seller, buyer, 'LATE00001');
  await Order.updateOne({ _id: o._id }, { autoReleaseAt: new Date(Date.now() - 1000) });
  const r = await api().post('/api/disputes').set(as(buyer)).send({ orderId: o._id, reason: 'สินค้าเสียหายระหว่างขนส่ง' });
  assert.equal(r.status, 400);
  assert.equal((await Order.findById(o._id)).status, 'SHIPPED');
});

test('dispute detail + chat: visible to buyer, seller and admin only; chat closes when resolved', async () => {
  const seller = await register('seller');
  const buyer = await register('buyer');
  const a = await admin();
  await topup(buyer, 5000);
  const o = await shippedOrder(seller, buyer, 'CHAT00001');
  const d = (await api().post('/api/disputes').set(as(buyer)).send({ orderId: o._id, reason: 'สินค้าไม่ตรงตามที่สั่ง' })).body.dispute;

  const stranger = await register('buyer', 'stranger');
  assert.equal((await api().get(`/api/disputes/${d.id}`)).status, 401);
  assert.equal((await api().get(`/api/disputes/${d.id}`).set(as(stranger))).status, 404);
  assert.equal((await api().post(`/api/disputes/${d.id}/messages`).set(as(stranger)).send({ text: 'hi' })).status, 404);

  const view = await api().get(`/api/disputes/${d.id}`).set(as(seller));
  assert.equal(view.status, 200);
  assert.equal(view.body.order.trackingNumber, 'CHAT00001');
  assert.equal(view.body.buyer.email, undefined); // ผู้ขายไม่เห็นข้อมูลติดต่อของผู้ซื้อผ่านหน้านี้
  const adminView = await api().get(`/api/disputes/${d.id}`).set(as(a));
  assert.equal(adminView.body.buyer.email, 'buyer@t.com');

  assert.equal((await api().post(`/api/disputes/${d.id}/messages`).set(as(seller)).send({ text: '' })).status, 400);
  assert.equal((await api().post(`/api/disputes/${d.id}/messages`).set(as(seller)).send({ text: 'x'.repeat(501) })).status, 400);
  assert.equal((await api().post(`/api/disputes/${d.id}/messages`).set(as(seller)).send({ text: 'ส่งของครบตามภาพแล้วครับ' })).status, 201);
  assert.equal((await api().post(`/api/disputes/${d.id}/messages`).set(as(buyer)).send({ text: 'กล่องเปล่าครับ' })).status, 201);
  const last = await api().post(`/api/disputes/${d.id}/messages`).set(as(a)).send({ text: 'ขอหลักฐานวิดีโอตอนแกะกล่อง' });
  assert.deepEqual(last.body.messages.map((m) => m.senderRole), ['seller', 'buyer', 'admin']);

  await api().put(`/api/admin/disputes/${d.id}/resolve`).set(as(a)).send({ decision: 'PAY_SELLER', adminNote: 'หลักฐานฝั่งผู้ซื้อไม่เพียงพอ' });
  assert.equal((await api().post(`/api/disputes/${d.id}/messages`).set(as(buyer)).send({ text: 'ยังไม่จบ' })).status, 400);
});

// ===================================================================== Admin Dispute Resolution
test('admin dispute panel: access control, filter/search, stats', async () => {
  const seller = await register('seller', 'sellerA');
  const buyer = await register('buyer', 'buyerA');
  const a = await admin();
  await topup(buyer, 50000);
  const o1 = await shippedOrder(seller, buyer, 'LIST00001');
  const o2 = await shippedOrder(seller, buyer, 'LIST00002');
  const d1 = (await api().post('/api/disputes').set(as(buyer)).send({ orderId: o1._id, reason: 'ได้รับสินค้าผิดรุ่น' })).body.dispute;
  await api().post('/api/disputes').set(as(buyer)).send({ orderId: o2._id, reason: 'สินค้าชำรุดจากการขนส่ง' });

  assert.equal((await api().get('/api/admin/disputes')).status, 401);
  assert.equal((await api().get('/api/admin/disputes').set(as(buyer))).status, 403);
  assert.equal((await api().get('/api/admin/disputes').set(as(seller))).status, 403);
  assert.equal((await api().put(`/api/admin/disputes/${d1.id}/resolve`).set(as(buyer)).send({ decision: 'REFUND_BUYER', adminNote: 'hack!!' })).status, 403);

  const all = await api().get('/api/admin/disputes').set(as(a));
  assert.equal(all.body.length, 2);
  assert.equal(all.body[0].buyer.name, 'buyerA');
  assert.equal(all.body[0].amount, 1000);
  assert.equal((await api().get('/api/admin/stats').set(as(a))).body.pendingDisputes, 2);

  await api().put(`/api/admin/disputes/${d1.id}/resolve`).set(as(a)).send({ decision: 'REFUND_BUYER', adminNote: 'ผู้ขายส่งผิดรุ่นจริง' });
  const pend = await api().get('/api/admin/disputes?status=PENDING').set(as(a));
  assert.equal(pend.body.length, 1);
  const done = await api().get('/api/admin/disputes?status=RESOLVED').set(as(a));
  assert.equal(done.body.length, 1);
  assert.equal(done.body[0].status, 'RESOLVED_REFUND_BUYER');
  assert.equal((await api().get('/api/admin/stats').set(as(a))).body.pendingDisputes, 1);

  assert.equal((await api().get(`/api/admin/disputes?q=${o2._id}`).set(as(a))).body.length, 1);
  assert.equal((await api().get('/api/admin/disputes?q=buyerA').set(as(a))).body.length, 2);
  assert.equal((await api().get('/api/admin/disputes?q=nobody').set(as(a))).body.length, 0);

  const detail = await api().get(`/api/admin/disputes/${d1.id}`).set(as(a));
  assert.equal(detail.body.order.trackingNumber, 'LIST00001');
  assert.equal(detail.body.order.items[0].name, 'Panel');
  assert.ok(detail.body.timeline.length >= 3);
  assert.equal((await api().get('/api/admin/disputes/notanid').set(as(a))).status, 404);
});

test('admin resolves dispute: refund buyer (REFUNDED) — note required, no double decision', async () => {
  const seller = await register('seller');
  const buyer = await register('buyer');
  const a = await admin();
  await topup(buyer, 5000);
  const o = await shippedOrder(seller, buyer, 'RSLV00001');
  assert.equal(await balance(buyer), 4000);
  const d = (await api().post('/api/disputes').set(as(buyer)).send({ orderId: o._id, reason: 'ไม่ได้รับสินค้า' + ' เลย' })).body.dispute;
  const resolve = (body) => api().put(`/api/admin/disputes/${d.id}/resolve`).set(as(a)).send(body);

  // ต้องมี adminNote และ decision ที่ถูกต้อง
  assert.equal((await resolve({ decision: 'REFUND_BUYER' })).status, 400);
  assert.equal((await resolve({ decision: 'REFUND_BUYER', adminNote: '   ' })).status, 400);
  assert.equal((await resolve({ decision: 'REFUND_BUYER', adminNote: 'x'.repeat(1001) })).status, 400);
  assert.equal((await resolve({ decision: 'GIVE_ALL', adminNote: 'เหตุผลอะไรก็ได้' })).status, 400);
  assert.equal((await Dispute.findById(d.id)).status, 'PENDING');
  assert.equal(await balance(buyer), 4000);

  const r = await resolve({ decision: 'REFUND_BUYER', adminNote: 'ตรวจสอบกับขนส่งแล้ว พัสดุสูญหาย' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.dispute.status, 'RESOLVED_REFUND_BUYER');
  assert.equal(r.body.dispute.adminNote, 'ตรวจสอบกับขนส่งแล้ว พัสดุสูญหาย');
  assert.ok(r.body.dispute.resolvedAt);

  const order = await Order.findById(o._id);
  assert.equal(order.status, 'REFUNDED');
  assert.equal(order.escrowStatus, 'REFUNDED');
  assert.equal(await balance(buyer), 5000);
  assert.equal(await balance(seller), 0);
  const tx = (await api().get('/api/wallet').set(as(buyer))).body.transactions;
  assert.equal(tx[0].type, 'REFUND');

  // ตัดสินซ้ำ (ทั้งแบบเดิม/แบบตรงข้าม/พร้อมกัน) ไม่ได้ และเงินไม่ขยับ
  assert.equal((await resolve({ decision: 'REFUND_BUYER', adminNote: 'ลองกดซ้ำ' })).status, 409);
  assert.equal((await resolve({ decision: 'PAY_SELLER', adminNote: 'เปลี่ยนใจ' })).status, 409);
  assert.equal(await balance(buyer), 5000);
  assert.equal(await balance(seller), 0);
  assert.equal((await api().put(`/api/admin/disputes/${'a'.repeat(24)}/resolve`).set(as(a)).send({ decision: 'REFUND_BUYER', adminNote: 'เหตุผลทดสอบ' })).status, 404);
});

test('admin resolves dispute: pay seller (COMPLETED); concurrent decisions apply exactly once', async () => {
  const seller = await register('seller');
  const buyer = await register('buyer');
  const a = await admin();
  await topup(buyer, 5000);
  const o = await shippedOrder(seller, buyer, 'RSLV00002');
  const d = (await api().post('/api/disputes').set(as(buyer)).send({ orderId: o._id, reason: 'สินค้าไม่ตรงปกครับ' })).body.dispute;

  const res = await Promise.all([
    api().put(`/api/admin/disputes/${d.id}/resolve`).set(as(a)).send({ decision: 'PAY_SELLER', adminNote: 'ผู้ขายมีหลักฐานการส่งครบ' }),
    api().put(`/api/admin/disputes/${d.id}/resolve`).set(as(a)).send({ decision: 'REFUND_BUYER', adminNote: 'ผู้ซื้อมีหลักฐานชัดเจน' }),
    api().put(`/api/admin/disputes/${d.id}/resolve`).set(as(a)).send({ decision: 'PAY_SELLER', adminNote: 'ผู้ขายมีหลักฐานการส่งครบ' }),
  ]);
  assert.equal(res.filter((r) => r.status === 200).length, 1, JSON.stringify(res.map((r) => r.body)));
  assert.equal(res.filter((r) => r.status === 409).length, 2);

  // เงิน 1,000 ต้องไปอยู่ที่ใดที่หนึ่งเท่านั้น ไม่ซ้ำ
  const total = (await balance(seller)) + (await balance(buyer));
  assert.equal(total, 5000);
  const fresh = await Dispute.findById(d.id);
  const order = await Order.findById(o._id);
  if (fresh.status === 'RESOLVED_PAY_SELLER') {
    assert.equal(order.status, 'COMPLETED');
    assert.equal(order.releasedBy, 'admin');
    assert.equal(await balance(seller), 1000);
  } else {
    assert.equal(fresh.status, 'RESOLVED_REFUND_BUYER');
    assert.equal(order.status, 'REFUNDED');
    assert.equal(await balance(buyer), 5000);
  }
});

test('admin pay-seller path pays seller and completes order', async () => {
  const seller = await register('seller');
  const buyer = await register('buyer');
  const a = await admin();
  await topup(buyer, 5000);
  const o = await shippedOrder(seller, buyer, 'RSLV00003');
  const d = (await api().post('/api/disputes').set(as(buyer)).send({ orderId: o._id, reason: 'สินค้าไม่ตรงปกครับ' })).body.dispute;
  const r = await api().put(`/api/admin/disputes/${d.id}/resolve`).set(as(a)).send({ decision: 'PAY_SELLER', adminNote: 'ผู้ขายส่งของครบตามหลักฐาน' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.dispute.status, 'RESOLVED_PAY_SELLER');
  assert.equal((await Order.findById(o._id)).status, 'COMPLETED');
  assert.equal(await balance(seller), 1000);
  assert.equal(await balance(buyer), 4000);
  assert.equal((await api().get('/api/wallet').set(as(seller))).body.transactions[0].type, 'RECEIVE_PAYMENT');
});

test('admin reject: order returns to SHIPPED with a fresh countdown and cannot be disputed again', async () => {
  const seller = await register('seller');
  const buyer = await register('buyer');
  const a = await admin();
  await topup(buyer, 5000);
  const o = await shippedOrder(seller, buyer, 'RSLV00004');
  const d = (await api().post('/api/disputes').set(as(buyer)).send({ orderId: o._id, reason: 'อยากคืนเงินเฉยๆ ครับ' })).body.dispute;
  const r = await api().put(`/api/admin/disputes/${d.id}/resolve`).set(as(a)).send({ decision: 'REJECT', adminNote: 'ไม่พบความผิดปกติ' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.dispute.status, 'REJECTED');

  const order = await Order.findById(o._id);
  assert.equal(order.status, 'SHIPPED');
  assert.equal(order.escrowStatus, 'HELD');
  assert.ok(order.autoReleaseAt && order.autoReleaseAt.getTime() > Date.now() + 6 * 24 * 3600 * 1000);
  assert.equal((await api().post('/api/disputes').set(as(buyer)).send({ orderId: o._id, reason: 'ขอเปิดอีกครั้งนะครับ' })).status, 409);
  assert.equal((await api().put(`/api/orders/${o._id}/complete`).set(as(buyer))).status, 200); // ยืนยันรับตามปกติได้
  assert.equal(await balance(seller), 1000);
});

test('admin has no wallet; seller/buyer wallets still work', async () => {
  const a = await admin();
  assert.equal(await Wallet.countDocuments({ userId: a.user.id }), 0); // ไม่มีแม้แต่เอกสาร Wallet
  assert.equal((await api().get('/api/wallet').set(as(a))).status, 403);
  assert.equal((await api().post('/api/wallet/topup').set(as(a)).send({ amount: 100 })).status, 403);
  assert.equal((await api().post('/api/wallet/withdraw').set(as(a)).send({ amount: 100 })).status, 403);
  const buyer = await register('buyer');
  assert.equal((await api().get('/api/wallet').set(as(buyer))).status, 200);
});

// ===================================================================== ความทนทานของการจ่ายเงิน
test('credit() is idempotent per (order, type): retrying never adds the money twice', async () => {
  const seller = await register('seller');
  const oid = new mongoose.Types.ObjectId();
  await credit(seller.user.id, 100, { type: 'REFUND', description: 'x', orderId: oid });
  await credit(seller.user.id, 100, { type: 'REFUND', description: 'x', orderId: oid });
  assert.equal(await balance(seller), 100);
  assert.equal(await Transaction.countDocuments({ referenceOrderId: oid, type: 'REFUND' }), 1);
  // คนละประเภทของออเดอร์เดียวกันบันทึกได้
  await credit(seller.user.id, 50, { type: 'RECEIVE_PAYMENT', description: 'y', orderId: oid });
  assert.equal(await balance(seller), 150);
  // ไม่มี orderId (เช่นเติมเงิน) บวกทุกครั้งตามปกติ
  await credit(seller.user.id, 10, { type: 'TOPUP', description: 'z' });
  await credit(seller.user.id, 10, { type: 'TOPUP', description: 'z' });
  assert.equal(await balance(seller), 170);
});

test('payout recovery: orders flipped to RELEASED/REFUNDED but never paid are completed exactly once', async () => {
  const seller = await register('seller');
  const buyer = await register('buyer');
  await topup(buyer, 10000);
  const rel = await shippedOrder(seller, buyer, 'REC000001');
  const ref = await shippedOrder(seller, buyer, 'REC000002');
  assert.equal(await balance(buyer), 8000);

  // จำลองเซิร์ฟเวอร์ดับหลังเปลี่ยนสถานะออเดอร์ แต่ก่อนโอนเงิน
  await Order.updateOne({ _id: rel._id }, { status: 'COMPLETED', escrowStatus: 'RELEASED', releasedBy: 'buyer', settled: false });
  await Order.updateOne({ _id: ref._id }, { status: 'REFUNDED', escrowStatus: 'REFUNDED', settled: false });
  assert.equal(await balance(seller), 0);

  assert.equal((await reconcilePayouts({ olderThanMs: 0 })).fixed, 2);
  assert.equal(await balance(seller), 1000);
  assert.equal(await balance(buyer), 9000);
  assert.equal((await Order.findById(rel._id)).settled, true);

  // รันซ้ำไม่จ่ายซ้ำ
  assert.equal((await reconcilePayouts({ olderThanMs: 0 })).fixed, 0);
  assert.equal(await balance(seller), 1000);
  assert.equal(await balance(buyer), 9000);
});

test('payout recovery: a recorded-but-unapplied transaction is applied once by the worker', async () => {
  const seller = await register('seller');
  await balance(seller); // ให้แน่ใจว่ามี Wallet
  const wallet = await Wallet.findOne({ userId: seller.user.id });
  await Transaction.create({ walletId: wallet._id, type: 'TOPUP', amount: 500, description: 'ค้าง', pendingApply: true });
  assert.equal(await balance(seller), 0);
  assert.equal((await reconcilePayouts({ olderThanMs: 0 })).fixed, 1);
  assert.equal(await balance(seller), 500);
  assert.equal((await reconcilePayouts({ olderThanMs: 0 })).fixed, 0);
  assert.equal(await balance(seller), 500);
});

test('cancelling an unshipped order refunds once and stays consistent with the payout ledger', async () => {
  const seller = await register('seller');
  const buyer = await register('buyer');
  await topup(buyer, 3000);
  const o = await placeOrder(seller, buyer);
  assert.equal(await balance(buyer), 2000);
  assert.equal((await api().put(`/api/orders/${o._id}/cancel`).set(as(buyer))).status, 200);
  assert.equal(await balance(buyer), 3000);
  assert.equal((await api().put(`/api/orders/${o._id}/cancel`).set(as(buyer))).status, 400);
  assert.equal(await balance(buyer), 3000);
  assert.equal((await Order.findById(o._id)).settled, true);
  assert.equal((await reconcilePayouts({ olderThanMs: 0 })).fixed, 0);
});

test('admin dispute misc: short order-number search, bogus decisions are 400 (not 500)', async () => {
  const seller = await register('seller');
  const buyer = await register('buyer');
  const a = await admin();
  await topup(buyer, 5000);
  const o = await shippedOrder(seller, buyer, 'MISC00001');
  const d = (await api().post('/api/disputes').set(as(buyer)).send({ orderId: o._id, reason: 'สินค้าไม่ตรงปกครับ' })).body.dispute;

  const short = String(o._id).slice(-6).toUpperCase();
  assert.equal((await api().get(`/api/admin/disputes?q=${encodeURIComponent('#' + short)}`).set(as(a))).body.length, 1);
  assert.equal((await api().get(`/api/admin/disputes?q=${short.toLowerCase()}`).set(as(a))).body.length, 1);

  for (const decision of ['constructor', '__proto__', 'toString', 42, null, '']) {
    const r = await api().put(`/api/admin/disputes/${d.id}/resolve`).set(as(a)).send({ decision, adminNote: 'เหตุผลทดสอบ' });
    assert.equal(r.status, 400, `decision ${decision}`);
  }
  assert.equal((await Dispute.findById(d.id)).status, 'PENDING');
});

// =====================================================================================
// Phase 7: รูปภาพ / โปรไฟล์ / แบนเนอร์ร้าน / รีวิวแบบมีรูป / ร้านยอดนิยม / แจ้งเตือน
// =====================================================================================
const JPEG_URL = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]).toString('base64')}`;
const PNG_URL = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]).toString('base64')}`;
const upload = (who, kind, dataUrl = JPEG_URL) => api().post('/api/uploads').set(as(who)).send({ kind, dataUrl });
async function uploadOk(who, kind, dataUrl) {
  const r = await upload(who, kind, dataUrl);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.url;
}
// ออเดอร์ที่ผู้ซื้อยืนยันรับสินค้าแล้ว (พร้อมรีวิว)
async function completedOrder(seller, buyer, tracking, opts) {
  const o = await shippedOrder(seller, buyer, tracking, opts);
  assert.equal((await api().put(`/api/orders/${o._id}/complete`).set(as(buyer))).status, 200);
  return o;
}

test('uploads: auth + role per kind, real image bytes only, size limit, served publicly with safe headers', async () => {
  const buyer = await register('buyer');
  const seller = await register('seller');

  assert.equal((await api().post('/api/uploads').send({ kind: 'avatar', dataUrl: JPEG_URL })).status, 401);
  assert.equal((await upload(buyer, 'nope')).status, 400);
  for (const kind of ['constructor', '__proto__', 'toString']) {
    assert.equal((await upload(buyer, kind)).status, 400, kind); // คีย์ของ Object.prototype ต้องไม่ผ่านเป็น kind
  }
  assert.equal((await upload(buyer, 'logo')).status, 403); // โลโก้/ปกร้านเฉพาะผู้ขาย
  assert.equal((await upload(buyer, 'banner')).status, 403);
  assert.equal((await upload(seller, 'review')).status, 403); // รูปรีวิวเฉพาะผู้ซื้อ

  // ไม่ใช่รูปจริง / รูปแบบไม่รองรับ / base64 เสีย
  const fake = `data:image/jpeg;base64,${Buffer.from('<html>alert(1)</html>').toString('base64')}`;
  assert.equal((await upload(buyer, 'avatar', fake)).status, 400);
  assert.equal((await upload(buyer, 'avatar', `data:image/svg+xml;base64,${Buffer.from('<svg/>').toString('base64')}`)).status, 400);
  assert.equal((await upload(buyer, 'avatar', 'data:image/jpeg;base64,@@@')).status, 400);
  assert.equal((await upload(buyer, 'avatar', 'not a data url')).status, 400);
  assert.equal((await api().post('/api/uploads').set(as(buyer)).send({ kind: 'avatar' })).status, 400); // ไม่ส่ง dataUrl

  // เกินเพดานขนาด (avatar 200KB) และเกินขนาด body รวม
  const big = `data:image/jpeg;base64,${Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(210 * 1024)]).toString('base64')}`;
  assert.equal((await upload(buyer, 'avatar', big)).status, 400);
  const huge = `data:image/jpeg;base64,${'A'.repeat(3 * 1024 * 1024)}`;
  assert.equal((await upload(buyer, 'avatar', huge)).status, 413);

  const up = await upload(buyer, 'avatar', PNG_URL);
  assert.equal(up.status, 201);
  assert.match(up.body.url, /^\/api\/images\/[a-f\d]{24}$/);

  const got = await api().get(up.body.url);
  assert.equal(got.status, 200);
  assert.equal(got.headers['content-type'], 'image/png');
  assert.equal(got.headers['x-content-type-options'], 'nosniff');
  assert.match(got.headers['cache-control'], /immutable/);
  assert.equal(got.headers['cross-origin-resource-policy'], 'cross-origin');
  assert.equal((await api().get('/api/images/' + '0'.repeat(24))).status, 404);
  assert.equal((await api().get('/api/images/xyz')).status, 404);
});

test('avatar: every role can set it, only from own uploads; replace/remove deletes the old image', async () => {
  const buyer = await register('buyer');
  const other = await register('buyer', 'other');
  const a = await admin();

  const mine = await uploadOk(buyer, 'avatar');
  const theirs = await uploadOk(other, 'avatar');
  const asLogo = await uploadOk(await register('seller'), 'logo');

  const put = (who, avatarUrl) => api().put('/api/auth/profile').set(as(who)).send({ avatarUrl });
  assert.equal((await put(buyer, theirs)).status, 400); // รูปของคนอื่น
  assert.equal((await put(buyer, asLogo)).status, 400); // ผิดชนิด
  assert.equal((await put(buyer, 'https://evil.example/x.png')).status, 400); // ลิงก์ภายนอก
  assert.equal((await put(buyer, '/api/images/' + '0'.repeat(24))).status, 400); // ไม่มีอยู่จริง

  const ok = await put(buyer, mine);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.user.avatarUrl, mine);
  assert.equal((await api().get('/api/auth/me').set(as(buyer))).body.avatarUrl, mine);

  // แก้ชื่ออย่างเดียวไม่กระทบรูป
  assert.equal((await api().put('/api/auth/profile').set(as(buyer)).send({ name: 'ใหม่' })).body.user.avatarUrl, mine);

  // เปลี่ยนรูป → รูปเก่าถูกลบ
  const next = await uploadOk(buyer, 'avatar', PNG_URL);
  assert.equal((await put(buyer, next)).status, 200);
  assert.equal((await api().get(mine)).status, 404);
  assert.equal((await api().get(next)).status, 200);

  // ลบรูป
  const cleared = await put(buyer, '');
  assert.equal(cleared.body.user.avatarUrl, '');
  assert.equal((await api().get(next)).status, 404);

  // Admin ก็ตั้งรูปโปรไฟล์ได้
  const adminPic = await uploadOk(a, 'avatar');
  assert.equal((await put(a, adminPic)).body.user.avatarUrl, adminPic);
});

test('store logo/banner: seller-only, own uploads of the right kind, shown on the public store page', async () => {
  const seller = await register('seller');
  const other = await register('seller', 'other');
  const buyer = await register('buyer');

  const logo = await uploadOk(seller, 'logo');
  const banner = await uploadOk(seller, 'banner', PNG_URL);
  const avatar = await uploadOk(seller, 'avatar');
  const foreign = await uploadOk(other, 'banner');

  const put = (who, body) => api().put('/api/stores/me').set(as(who)).send(body);
  assert.equal((await put(buyer, { storeLogoUrl: logo })).status, 403);
  assert.equal((await put(seller, { storeLogoUrl: avatar })).status, 400); // ผิดชนิด
  assert.equal((await put(seller, { storeBannerUrl: foreign })).status, 400); // ของคนอื่น
  assert.equal((await put(seller, { storeBannerUrl: logo })).status, 400);

  const ok = await put(seller, { storeName: 'ร้านสวย', storeLogoUrl: logo, storeBannerUrl: banner });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.user.storeLogoUrl, logo);
  assert.equal(ok.body.user.storeBannerUrl, banner);

  const page = (await api().get(`/api/stores/${seller.user.id}`)).body;
  assert.equal(page.store.logoUrl, logo);
  assert.equal(page.store.bannerUrl, banner);

  // ส่งเฉพาะชื่อ → รูปเดิมยังอยู่
  const rename = await put(seller, { storeName: 'ร้านสวยมาก' });
  assert.equal(rename.body.user.storeLogoUrl, logo);

  // ลบแบนเนอร์ → ไฟล์ถูกลบด้วย, โลโก้ยังอยู่
  const rm = await put(seller, { storeBannerUrl: '' });
  assert.equal(rm.body.user.storeBannerUrl, '');
  assert.equal((await api().get(banner)).status, 404);
  assert.equal((await api().get(logo)).status, 200);
});

test('trust level + Bayesian score helpers', () => {
  assert.equal(trustLevel(0, 0), 'new');
  assert.equal(trustLevel(5, 1), 'good'); // รีวิวน้อยเกินไปยังไม่ให้ตรา "น่าเชื่อถือ" (ต้องมีอย่างน้อย 3 รีวิว)
  assert.equal(trustLevel(4.8, 3), 'trusted');
  assert.equal(trustLevel(4.2, 2), 'good');
  assert.equal(trustLevel(3.4, 5), 'normal');
  assert.equal(trustLevel(2.1, 4), 'caution');
  assert.equal(trustLevel(1, 2), 'normal'); // ข้อมูลน้อย ยังไม่ตัดสินว่า "ควรระวัง"
  // ระดับคำนวณจากค่าเฉลี่ยดิบ: 4.46 ไม่ถูกปัดเป็น 4.5 แล้วได้ตรา "น่าเชื่อถือ" (แต่ค่าที่แสดงปัดเป็น 4.5 ได้)
  assert.equal(trustOf(4.46, 3).level, 'good');
  assert.equal(trustOf(4.46, 3).avg, 4.5);
  assert.equal(trustOf(4.5, 3).level, 'trusted');
  // ร้านที่ได้ 5★ เพียงรีวิวเดียว แพ้ร้านที่ได้ 5★ สม่ำเสมอหลายรีวิว
  assert.ok(bayesianScore(5, 6, 4.3) > bayesianScore(5, 1, 4.3));
  assert.ok(bayesianScore(5, 1, 4.3) > bayesianScore(3, 4, 4.3));
});

test('reviews with images: attach own review photos, reviewer avatar + trust, gallery, filters, pagination', async () => {
  const seller = await register('seller');
  const buyer = await register('buyer', 'somying');
  const stranger = await register('buyer', 'stranger');
  await topup(buyer, 100000);

  const avatar = await uploadOk(buyer, 'avatar');
  await api().put('/api/auth/profile').set(as(buyer)).send({ avatarUrl: avatar });

  const o = await completedOrder(seller, buyer, 'REVIMG001', { price: 100, stock: 10 });
  const pic1 = await uploadOk(buyer, 'review');
  const pic2 = await uploadOk(buyer, 'review', PNG_URL);
  const strangerPic = await uploadOk(stranger, 'review');
  const sellerAvatar = await uploadOk(seller, 'avatar');

  const post = (who, body) => api().post('/api/reviews').set(as(who)).send({ orderId: o._id, ...body });
  assert.equal((await post(buyer, { rating: 5, images: 'x' })).status, 400); // ต้องเป็นรายการ
  assert.equal((await post(buyer, { rating: 5, images: [strangerPic] })).status, 400); // รูปของคนอื่น
  assert.equal((await post(buyer, { rating: 5, images: [avatar] })).status, 400); // ผิดชนิด (avatar ไม่ใช่ review)
  assert.equal((await post(buyer, { rating: 5, images: ['http://x.test/a.png'] })).status, 400);
  const five = await Promise.all([1, 2, 3, 4, 5].map(() => uploadOk(buyer, 'review')));
  assert.equal((await post(buyer, { rating: 5, images: five })).status, 400); // เกิน 4 รูป
  assert.equal((await post(seller, { rating: 4, images: [sellerAvatar] })).status, 400); // ผู้ขายแนบรูปรีวิวไม่ได้

  const ok = await post(buyer, { rating: 5, comment: 'ของดีมาก', images: [pic1, pic2, pic1] });
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  assert.deepEqual(ok.body.review.images, [pic1, pic2]); // ตัดรูปซ้ำ
  assert.equal((await api().get(pic1)).status, 200); // รูปรีวิวไม่ถูกลบ

  // ผู้ขายให้คะแนนผู้ซื้อ 3 ออเดอร์ (5★) → ผู้ซื้อได้ตรา "น่าเชื่อถือ"
  for (let i = 0; i < 3; i += 1) {
    const oo = await completedOrder(seller, buyer, `REVIMG10${i}`, { price: 100, stock: 10 });
    assert.equal((await api().post('/api/reviews').set(as(seller)).send({ orderId: oo._id, rating: 5 })).status, 201);
  }

  const p = o.items[0].productId;
  const list = (await api().get(`/api/reviews/product/${p}`)).body;
  assert.equal(list.rating.count, 1);
  assert.equal(list.withImages, 1);
  assert.equal(list.breakdown['5'], 1);
  assert.deepEqual(list.photos.map((x) => x.url).sort(), [pic1, pic2].sort());
  const r = list.reviews[0];
  assert.equal(r.reviewer.name, 'somying');
  assert.equal(r.reviewer.avatarUrl, avatar);
  assert.equal(r.reviewer.trust.level, 'trusted');
  assert.equal(r.reviewer.trust.count, 3);
  assert.deepEqual(r.images, [pic1, pic2]);
  assert.equal(r.products[0].name, 'Panel');

  // หน้าร้านเห็นรีวิวเดียวกัน
  const store = (await api().get(`/api/reviews/seller/${seller.user.id}`)).body;
  assert.equal(store.rating.count, 1);
  assert.equal(store.reviews[0].images.length, 2);

  // ผู้ซื้อเห็นตรา trust ของตัวเองใน /received
  const rec = (await api().get('/api/reviews/received').set(as(buyer))).body;
  assert.equal(rec.trust.level, 'trusted');

  // ผู้ขายเห็น buyerTrust + avatar ผู้ซื้อในหน้าออเดอร์
  const selling = (await api().get('/api/orders/selling').set(as(seller))).body[0];
  assert.equal(selling.buyerTrust.level, 'trusted');
  assert.equal(selling.buyerId.avatarUrl, avatar);
});

test('review feed: star filter, photos-only filter, pagination, breakdown', async () => {
  const seller = await register('seller');
  const p = await newProduct(seller, { price: 10, stock: 100 });
  // สร้างรีวิว 12 รายการตรงๆ (5★ x6 มีรูป 2, 4★ x4, 1★ x2)
  const buyers = [];
  for (let i = 0; i < 12; i += 1) buyers.push(await register('buyer', `b${i}`));
  const ratings = [5, 5, 5, 5, 5, 5, 4, 4, 4, 4, 1, 1];
  for (let i = 0; i < 12; i += 1) {
    await Review.create({
      orderId: new mongoose.Types.ObjectId(),
      type: 'BUYER_TO_SELLER',
      reviewerId: buyers[i].user.id,
      revieweeId: seller.user.id,
      rating: ratings[i],
      comment: `r${i}`,
      productIds: [p._id],
      images: i < 2 ? [`/api/images/${'a'.repeat(23)}${i}`] : [],
      createdAt: new Date(Date.now() - i * 1000), // i น้อย = ใหม่กว่า
    });
  }
  const get = (q = '') => api().get(`/api/reviews/product/${p._id}${q}`).then((r) => r.body);

  const first = await get();
  assert.equal(first.rating.count, 12);
  assert.equal(first.total, 12);
  assert.equal(first.pages, 2);
  assert.equal(first.reviews.length, 10);
  assert.equal(first.reviews[0].comment, 'r0'); // ใหม่สุดก่อน
  assert.deepEqual(first.breakdown, { 1: 2, 2: 0, 3: 0, 4: 4, 5: 6 });
  assert.equal(first.withImages, 2);
  assert.equal((await get('?page=2')).reviews.length, 2);
  assert.equal((await get('?page=99')).reviews.length, 0); // เกินหน้า → ว่าง ไม่พัง

  const one = await get('?rating=1');
  assert.equal(one.total, 2);
  assert.ok(one.reviews.every((r) => r.rating === 1));
  assert.equal(one.rating.count, 12); // สรุปรวมไม่ถูกกรอง
  assert.equal((await get('?rating=abc')).total, 12); // ค่าเพี้ยน = ไม่กรอง
  assert.equal((await get('?rating=7')).total, 12);

  const withImg = await get('?withImages=1');
  assert.equal(withImg.total, 2);
  assert.ok(withImg.reviews.every((r) => r.images.length === 1));
  assert.equal((await get('?withImages=1&rating=1')).total, 0);
  assert.equal((await api().get('/api/reviews/product/not-an-id')).body.reviews.length, 0);
});

test('top-rated stores: Bayesian ranking, hides banned stores, links data for the store front', async () => {
  const A = await register('seller', 'A'); // 1 รีวิว 5★
  const B = await register('seller', 'B'); // 6 รีวิว 5★
  const D = await register('seller', 'D'); // 4 รีวิว 3★
  const X = await register('seller', 'X'); // 5★ x5 แต่ถูกแบน
  const buyer = await register('buyer');
  const rate = async (seller, stars, n) => {
    for (let i = 0; i < n; i += 1) {
      await Review.create({
        orderId: new mongoose.Types.ObjectId(),
        type: 'BUYER_TO_SELLER',
        reviewerId: buyer.user.id,
        revieweeId: seller.user.id,
        rating: stars,
      });
    }
  };
  await rate(A, 5, 1);
  await rate(B, 5, 6);
  await rate(D, 3, 4);
  await rate(X, 5, 5);
  await api().put(`/api/stores/me`).set(as(B)).send({ storeName: 'ร้านบี', storeLogoUrl: await uploadOk(B, 'logo') });
  const a = await admin();
  assert.equal((await api().put(`/api/admin/users/${X.user.id}/ban`).set(as(a)).send({ reason: 'test' })).status, 200);

  const top = (await api().get('/api/stores/top')).body;
  assert.deepEqual(top.map((s) => s.id), [B.user.id, A.user.id, D.user.id]);
  assert.equal(top[0].name, 'ร้านบี');
  assert.ok(top[0].logoUrl.startsWith('/api/images/'));
  assert.deepEqual(top[0].rating, { avg: 5, count: 6 });
  assert.equal((await api().get('/api/stores/top?limit=1')).body.length, 1);
  assert.equal((await api().get(`/api/stores/${top[0].id}`)).status, 200); // การ์ดลิงก์ไปหน้าร้านได้จริง

  // ไม่มีรีวิวเลย → รายการว่าง (frontend ซ่อนทั้งส่วน)
  await Review.deleteMany({});
  assert.deepEqual((await api().get('/api/stores/top')).body, []);
});

test('popular products: ranked by units sold (cancelled orders excluded), hidden products/banned sellers skipped', async () => {
  const seller = await register('seller');
  const banned = await register('seller', 'banned');
  const buyer = await register('buyer');
  await topup(buyer, 100000);

  assert.deepEqual((await api().get('/api/products/popular')).body, []); // ยังไม่มียอดขาย

  const cheap = await newProduct(seller, { name: 'Cheap', price: 10, stock: 100 });
  const hot = await newProduct(seller, { name: 'Hot', price: 10, stock: 100 });
  const cancelled = await newProduct(seller, { name: 'Cancelled', price: 10, stock: 100 });
  const bannedProduct = await newProduct(banned, { name: 'BannedItem', price: 10, stock: 100 });

  const buy = async (p, quantity) => {
    await api().post('/api/cart').set(as(buyer)).send({ productId: p._id, quantity });
    const co = await api().post('/api/orders/checkout').set(as(buyer)).send({ shippingAddress: '9 Ship St' });
    assert.equal(co.status, 201, JSON.stringify(co.body));
    return co.body.orders[0];
  };
  await buy(cheap, 1);
  await buy(hot, 7);
  const c = await buy(cancelled, 50);
  await buy(bannedProduct, 20);
  assert.equal((await api().put(`/api/orders/${c._id}/cancel`).set(as(buyer))).status, 200);
  const a = await admin();
  await api().put(`/api/admin/users/${banned.user.id}/ban`).set(as(a)).send({ reason: 'x' });

  const pop = (await api().get('/api/products/popular')).body;
  assert.deepEqual(pop.map((p) => p.name), ['Hot', 'Cheap']);
  assert.equal(pop[0].sold, 7);
  assert.equal(pop[1].sold, 1);
  assert.equal(pop[0].seller.storeName, 'seller');
  assert.deepEqual(pop[0].rating, { avg: 0, count: 0 });
  assert.equal((await api().get('/api/products/popular?limit=1')).body.length, 1);

  const detail = (await api().get(`/api/products/${hot._id}`)).body;
  assert.equal(detail.sold, 7);
  assert.deepEqual(detail.sellerRating, { avg: 0, count: 0 });

  // ร้านเห็น "ขายแล้ว" ต่อสินค้า และยอดรวมของร้าน
  const store = (await api().get(`/api/stores/${seller.user.id}`)).body;
  assert.equal(store.store.soldTotal, 8);
  assert.equal(store.products.find((p) => p.name === 'Hot').sold, 7);
});

test('notifications: buyer=confirm receipt, seller=ship + disputes, admin=pending disputes; badge clears as tasks finish', async () => {
  const seller = await register('seller');
  const buyer = await register('buyer');
  const a = await admin();
  await topup(buyer, 100000);
  const notes = async (who) => (await api().get('/api/notifications').set(as(who))).body;

  assert.equal((await api().get('/api/notifications')).status, 401);
  for (const who of [seller, buyer, a]) assert.equal((await notes(who)).total, 0);

  // ออเดอร์ใหม่ → ผู้ขายต้องจัดส่ง
  const o1 = await placeOrder(seller, buyer);
  const sn = await notes(seller);
  assert.equal(sn.total, 1);
  assert.equal(sn.items[0].key, 'seller_ship');
  assert.equal(sn.items[0].href, '/seller/orders?filter=todo');
  assert.equal(sn.items[0].entries.length, 1);
  assert.equal((await notes(buyer)).total, 0); // ยังไม่ส่ง → ผู้ซื้อไม่มีงาน

  // จัดส่งแล้ว → งานย้ายไปที่ผู้ซื้อ (ยืนยันรับสินค้า)
  await ship(seller, o1, 'NOTIFY0001');
  assert.equal((await notes(seller)).total, 0);
  const bn = await notes(buyer);
  assert.equal(bn.total, 1);
  assert.equal(bn.items[0].key, 'buyer_confirm');
  assert.equal(bn.items[0].href, '/history');

  // ผู้ซื้อยืนยัน → เคลียร์
  await api().put(`/api/orders/${o1._id}/complete`).set(as(buyer));
  assert.equal((await notes(buyer)).total, 0);

  // เปิดข้อพิพาท → ผู้ขายต้องชี้แจง, Admin ต้องตัดสิน, ผู้ซื้อไม่มีงานค้าง
  const o2 = await shippedOrder(seller, buyer, 'NOTIFY0002');
  const d = (await api().post('/api/disputes').set(as(buyer)).send({ orderId: o2._id, reason: 'สินค้าไม่ตรงปกครับ' })).body.dispute;
  assert.equal((await notes(buyer)).total, 0);
  const sn2 = await notes(seller);
  assert.equal(sn2.items[0].key, 'seller_dispute');
  assert.equal(sn2.items[0].entries[0].href, `/disputes/${d.id}`);
  const an = await notes(a);
  assert.equal(an.total, 1);
  assert.equal(an.items[0].key, 'admin_disputes');
  assert.equal(an.items[0].href, '/admin/disputes');
  assert.equal(an.items[0].entries[0].href, `/admin/disputes/${d.id}`);

  // Admin ตัดสิน → เคลียร์ทั้งสองฝั่ง
  const res = await api().put(`/api/admin/disputes/${d.id}/resolve`).set(as(a)).send({ decision: 'REFUND_BUYER', adminNote: 'ตรวจสอบหลักฐานแล้ว' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal((await notes(a)).total, 0);
  assert.equal((await notes(seller)).total, 0);
});

test('dispute chat carries avatars for buyer, seller and admin', async () => {
  const seller = await register('seller');
  const buyer = await register('buyer');
  const a = await admin();
  await topup(buyer, 100000);
  const buyerPic = await uploadOk(buyer, 'avatar');
  const logo = await uploadOk(seller, 'logo');
  const adminPic = await uploadOk(a, 'avatar');
  await api().put('/api/auth/profile').set(as(buyer)).send({ avatarUrl: buyerPic });
  await api().put('/api/stores/me').set(as(seller)).send({ storeLogoUrl: logo });
  await api().put('/api/auth/profile').set(as(a)).send({ avatarUrl: adminPic });

  const o = await shippedOrder(seller, buyer, 'AVATAR0001');
  const d = (await api().post('/api/disputes').set(as(buyer)).send({ orderId: o._id, reason: 'สินค้าไม่ตรงปกครับ' })).body.dispute;
  for (const who of [buyer, seller, a]) {
    assert.equal((await api().post(`/api/disputes/${d.id}/messages`).set(as(who)).send({ text: 'สวัสดี' })).status, 201);
  }
  const detail = (await api().get(`/api/disputes/${d.id}`).set(as(a))).body;
  assert.equal(detail.buyer.avatarUrl, buyerPic);
  assert.equal(detail.seller.avatarUrl, logo);
  assert.deepEqual(detail.messages.map((m) => m.senderAvatarUrl), [buyerPic, logo, adminPic]);
});

test('JSON body limit is small everywhere except /api/uploads', async () => {
  const big = 'x'.repeat(150 * 1024); // เกิน 100kb (ค่าปริยาย) แต่ไม่ถึง 2MB
  assert.equal((await api().post('/api/auth/login').send({ email: 'a@b.co', password: big })).status, 413);
  const buyer = await register('buyer');
  // /api/uploads รับ body ใหญ่กว่าได้ (ตรวจต่อด้วยกติกาของรูป: ไม่ใช่ไฟล์รูปจริง → 400 ไม่ใช่ 413)
  const r = await api().post('/api/uploads').set(as(buyer)).send({ kind: 'avatar', dataUrl: `data:image/jpeg;base64,${big}` });
  assert.equal(r.status, 400);
});

test('image quota per day; cleanup worker removes only old unreferenced images', async () => {
  const buyer = await register('buyer');
  const heavy = await register('buyer', 'heavy');
  const seller = await register('seller');
  const idOf = (url) => new mongoose.Types.ObjectId(url.split('/').pop());

  // โควตา 40 รูปต่อ 24 ชั่วโมง
  for (let i = 0; i < 40; i += 1) await uploadOk(heavy, 'review');
  const over = await upload(heavy, 'review');
  assert.equal(over.status, 429);
  assert.equal((await upload(buyer, 'avatar')).status, 201); // บัญชีอื่นไม่โดนผลกระทบ

  const avatar = await uploadOk(buyer, 'avatar');
  await api().put('/api/auth/profile').set(as(buyer)).send({ avatarUrl: avatar });
  const logo = await uploadOk(seller, 'logo');
  await api().put('/api/stores/me').set(as(seller)).send({ storeLogoUrl: logo });
  const orphanOld = await uploadOk(buyer, 'review');
  const orphanFresh = await uploadOk(buyer, 'review');

  // ทำให้รูปทั้งหมดยกเว้น orphanFresh "เก่า" เกิน 24 ชม. (แก้ผ่าน collection ตรง เพราะ Mongoose timestamps กัน)
  const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
  await Image.collection.updateMany({ _id: { $ne: idOf(orphanFresh) } }, { $set: { createdAt: old } });

  const r = await runImageCleanup();
  assert.equal(r.removed, 40 + 1 + 1); // รูปรีวิวของ heavy 40 + รูป avatar ที่ไม่ได้ใช้ของ buyer 1 + orphanOld 1
  assert.equal((await api().get(avatar)).status, 200); // ที่ใช้อยู่ไม่ถูกลบ
  assert.equal((await api().get(logo)).status, 200);
  assert.equal((await api().get(orphanOld)).status, 404);
  assert.equal((await api().get(orphanFresh)).status, 200); // ยังไม่ถึง 24 ชม.

  // รูปรีวิวที่ถูกแนบกับรีวิวแล้วต้องไม่ถูกลบ
  await topup(buyer, 5000);
  const o = await completedOrder(seller, buyer, 'CLEAN0001');
  const pic = await uploadOk(buyer, 'review');
  const post = await api().post('/api/reviews').set(as(buyer)).send({ orderId: o._id, rating: 5, images: [pic] });
  assert.equal(post.status, 201, JSON.stringify(post.body));
  await Image.collection.updateMany({}, { $set: { createdAt: old } });
  await runImageCleanup();
  assert.equal((await api().get(pic)).status, 200);
});
