const express = require('express');
const Order = require('../models/Order');
const Dispute = require('../models/Dispute');
const Conversation = require('../models/Conversation');
const auth = require('../middleware/auth');
const { sideOf, loadPeople, conversationView } = require('../utils/chat');

const router = express.Router();

const PREVIEW = 3; // แสดงรายการตัวอย่างในแต่ละหมวดไม่เกินกี่รายการ
const shortId = (id) => String(id).slice(-6).toUpperCase();
const money = (n) => `฿${Number(n || 0).toLocaleString('en-US')}`;
const dateTh = (d) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });

// งานที่ต้องทำของผู้ใช้ตามบทบาท (ใช้แสดง Badge ที่แท็บเมนูที่เกี่ยวข้อง: คำสั่งซื้อ / Seller Orders / Disputes / แชต — ไม่แสดงที่ไอคอนโปรไฟล์)
//   Buyer  → ออเดอร์ที่จัดส่งแล้วและรอกด "ยืนยันรับสินค้า"
//   Seller → ออเดอร์ใหม่ที่รอจัดส่ง/กรอกเลขพัสดุ + ข้อพิพาทที่ต้องชี้แจง
//   Admin  → ข้อพิพาทที่รอตัดสิน
//   ทุกบทบาท → ข้อความแชตใหม่ที่ยังไม่ได้อ่าน (key = chat_unread)
// รูปแบบ: { total, items: [{ key, label, description, count, href, cta, entries: [{ id, text, hint, href }] }] }
async function buyerTasks(userId) {
  const filter = { buyerId: userId, status: 'SHIPPED' };
  const [count, rows] = await Promise.all([
    Order.countDocuments(filter),
    // เรียงตามใกล้ครบกำหนดปล่อยเงินอัตโนมัติที่สุดก่อน
    Order.find(filter).sort({ autoReleaseAt: 1, shippedAt: 1 }).limit(PREVIEW).select('totalAmount trackingNumber autoReleaseAt'),
  ]);
  if (!count) return [];
  return [
    {
      key: 'buyer_confirm',
      label: 'รอยืนยันรับสินค้า',
      description: 'สินค้าจัดส่งแล้ว ตรวจสอบและกดยืนยันรับสินค้า หรือเปิดข้อพิพาทหากมีปัญหา',
      count,
      href: '/history',
      cta: 'ไปที่คำสั่งซื้อ',
      entries: rows.map((o) => ({
        id: String(o._id),
        text: `ออเดอร์ #${shortId(o._id)} · ${money(o.totalAmount)}`,
        hint: o.autoReleaseAt ? `ปล่อยเงินอัตโนมัติ ${dateTh(o.autoReleaseAt)}` : `เลขพัสดุ ${o.trackingNumber || '-'}`,
        href: '/history',
      })),
    },
  ];
}

async function sellerTasks(userId) {
  const todo = { sellerId: userId, status: 'PENDING_SHIPMENT' };
  const disputed = { sellerId: userId, status: 'DISPUTED' };
  const [todoCount, todoRows, disputedCount, disputedRows] = await Promise.all([
    Order.countDocuments(todo),
    Order.find(todo).sort({ createdAt: 1 }).limit(PREVIEW).select('totalAmount createdAt items'),
    Order.countDocuments(disputed),
    Order.find(disputed).sort({ disputedAt: 1 }).limit(PREVIEW).select('totalAmount disputeId'),
  ]);
  const tasks = [];
  if (todoCount) {
    tasks.push({
      key: 'seller_ship',
      label: 'ออเดอร์ใหม่รอจัดส่ง',
      description: 'ผู้ซื้อชำระเงินแล้ว (เงินอยู่ใน Escrow) — จัดส่งสินค้าและกรอกเลขพัสดุ',
      count: todoCount,
      href: '/seller/orders?filter=todo',
      cta: 'ไปกรอกเลขพัสดุ',
      entries: todoRows.map((o) => ({
        id: String(o._id),
        text: `ออเดอร์ #${shortId(o._id)} · ${money(o.totalAmount)}`,
        hint: `${(o.items || []).reduce((s, i) => s + (i.quantity || 0), 0)} ชิ้น · สั่งเมื่อ ${dateTh(o.createdAt)}`,
        href: '/seller/orders?filter=todo',
      })),
    });
  }
  if (disputedCount) {
    tasks.push({
      key: 'seller_dispute',
      label: 'ข้อพิพาทที่ต้องชี้แจง',
      description: 'ผู้ซื้อเปิดข้อพิพาท เงินถูก Freeze — ตอบชี้แจงให้ Admin พิจารณา',
      count: disputedCount,
      href: '/seller/orders?filter=disputed',
      cta: 'ดูข้อพิพาท',
      entries: disputedRows.map((o) => ({
        id: String(o._id),
        text: `ออเดอร์ #${shortId(o._id)} · ${money(o.totalAmount)}`,
        hint: 'รอ Admin ตัดสิน',
        href: o.disputeId ? `/disputes/${o.disputeId}` : '/seller/orders?filter=disputed',
      })),
    });
  }
  return tasks;
}

async function adminTasks() {
  const filter = { status: 'PENDING' };
  const [count, rows] = await Promise.all([
    Dispute.countDocuments(filter),
    Dispute.find(filter).sort({ createdAt: 1 }).limit(PREVIEW).select('orderId amount createdAt'),
  ]);
  if (!count) return [];
  return [
    {
      key: 'admin_disputes',
      label: 'ข้อพิพาทรอตัดสิน',
      description: 'มีคำร้องที่ Freeze เงินไว้ รอ Admin ตรวจสอบหลักฐานและตัดสิน',
      count,
      href: '/admin/disputes',
      cta: 'ไปที่ Dispute Panel',
      entries: rows.map((d) => ({
        id: String(d._id),
        text: `ออเดอร์ #${shortId(d.orderId)} · ${money(d.amount)}`,
        hint: `เปิดเมื่อ ${dateTh(d.createdAt)}`,
        href: `/admin/disputes/${d._id}`,
      })),
    },
  ];
}

// ข้อความแชตที่ยังไม่ได้อ่าน (ทุกบทบาท): ผู้ซื้อ/ผู้ขาย = ห้องแชตซื้อขาย + ห้องติดต่อ Admin, Admin = ห้องซัพพอร์ตที่ผู้ใช้ส่งมา
// นับเป็น "จำนวนห้องที่มีข้อความใหม่" (ไม่ใช่จำนวนข้อความ) ให้ Badge ไม่พุ่งสูงเกินจริง
async function chatTasks(user) {
  const filter =
    user.role === 'admin'
      ? { type: 'SUPPORT', unreadPeer: { $gt: 0 } }
      : {
          $or: [
            { type: 'DIRECT', ownerId: user.id, unreadOwner: { $gt: 0 } },
            { type: 'DIRECT', peerId: user.id, unreadPeer: { $gt: 0 } },
            { type: 'SUPPORT', ownerId: user.id, unreadOwner: { $gt: 0 } },
          ],
        };
  const [count, rows] = await Promise.all([
    Conversation.countDocuments(filter),
    Conversation.find(filter).sort({ lastMessageAt: -1 }).limit(PREVIEW),
  ]);
  if (!count) return [];
  const people = await loadPeople(rows.flatMap((c) => [c.ownerId, c.peerId]));
  return [
    {
      key: 'chat_unread',
      label: 'ข้อความใหม่',
      description: 'มีข้อความแชตที่ยังไม่ได้อ่าน',
      count,
      href: '/chat',
      cta: 'เปิดกล่องข้อความ',
      entries: rows.map((c) => {
        const v = conversationView(c, sideOf(c, user), people, user.id);
        return {
          id: String(c._id),
          text: `${v.counterpart.name}: ${v.lastMessage?.preview || 'ข้อความใหม่'}`,
          hint: `${v.unread} ข้อความใหม่${c.type === 'SUPPORT' && c.topic === 'APPEAL' ? ' · ยื่นอุทธรณ์' : ''}`,
          href: `/chat/${c._id}`,
        };
      }),
    },
  ];
}

router.get('/', auth, async (req, res) => {
  const tasks =
    req.user.role === 'seller'
      ? await sellerTasks(req.user.id)
      : req.user.role === 'admin'
        ? await adminTasks()
        : await buyerTasks(req.user.id);
  const items = [...tasks, ...(await chatTasks(req.user))];
  res.json({ total: items.reduce((s, i) => s + i.count, 0), items });
});

module.exports = router;
