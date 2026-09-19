const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const Product = require('../models/Product');

let mongod;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});
after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
beforeEach(async () => {
  for (const c of Object.values(mongoose.connection.collections)) await c.deleteMany({});
});

const api = () => request(app);
async function register(role, name = role) {
  const res = await api()
    .post('/api/auth/register')
    .send({ name, email: `${name}@t.com`, password: '123456', role, address: '1 Test Rd' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return { token: res.body.token, user: res.body.user };
}
const as = (t) => ({ Authorization: `Bearer ${t.token}` });
async function topup(t, amount) {
  return api().post('/api/wallet/topup').set(as(t)).send({ amount });
}
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

  const admin = await api().post('/api/auth/register').send({ name: 'x', email: 'x@t.com', password: '123456', role: 'admin' });
  assert.equal(admin.body.user.role, 'buyer'); // ไม่ยอมให้สมัครเป็น admin

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

  const shipped = await api().put(`/api/orders/${order._id}/ship`).set(as(seller)).send({ trackingNumber: 'TH123' });
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

test('wallet: topup limits, withdraw cannot exceed balance', async () => {
  const seller = await register('seller');
  assert.equal((await topup(seller, 0)).status, 400);
  assert.equal((await topup(seller, 1e9)).status, 400);
  assert.equal((await topup(seller, 1000)).body.balance, 1000);
  assert.equal((await api().post('/api/wallet/withdraw').set(as(seller)).send({ amount: 5000 })).status, 400);
  const w = await api().post('/api/wallet/withdraw').set(as(seller)).send({ amount: 400 });
  assert.equal(w.body.balance, 600);
  const tx = (await api().get('/api/wallet').set(as(seller))).body.transactions;
  assert.deepEqual(tx.map((t) => t.type), ['WITHDRAW', 'TOPUP']);
  assert.ok(tx[0].description);
});
