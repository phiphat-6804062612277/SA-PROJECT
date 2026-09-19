const express = require('express');
const Order = require('../models/Order');
const Dispute = require('../models/Dispute');
const auth = require('../middleware/auth');

const router = express.Router();

const PREVIEW = 3; // แสดงรายการตัวอย่างในแต่ละหมวดไม่เกินกี่รายการ
const shortId = (id) => String(id).slice(-6).toUpperCase();
const money = (n) => `฿${Number(n || 0).toLocaleString('en-US')}`;
const dateTh = (d) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });

// งานที่ต้องทำของผู้ใช้ตามบทบาท (ใช้แสดง Badge ที่ไอคอนโปรไฟล์/แท็บเมนู และ Dropdown สรุปงาน)
//   Buyer  → ออเดอร์ที่จัดส่งแล้วและรอกด "ยืนยันรับสินค้า"
//   Seller → ออเดอร์ใหม่ที่รอจัดส่ง/กรอกเลขพัสดุ + ข้อพิพาทที่ต้องชี้แจง
//   Admin  → ข้อพิพาทที่รอตัดสิน
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
      href: '/seller?tab=orders&filter=todo',
      cta: 'ไปกรอกเลขพัสดุ',
      entries: todoRows.map((o) => ({
        id: String(o._id),
        text: `ออเดอร์ #${shortId(o._id)} · ${money(o.totalAmount)}`,
        hint: `${(o.items || []).reduce((s, i) => s + (i.quantity || 0), 0)} ชิ้น · สั่งเมื่อ ${dateTh(o.createdAt)}`,
        href: '/seller?tab=orders&filter=todo',
      })),
    });
  }
  if (disputedCount) {
    tasks.push({
      key: 'seller_dispute',
      label: 'ข้อพิพาทที่ต้องชี้แจง',
      description: 'ผู้ซื้อเปิดข้อพิพาท เงินถูก Freeze — ตอบชี้แจงให้ Admin พิจารณา',
      count: disputedCount,
      href: '/seller?tab=orders&filter=disputed',
      cta: 'ดูข้อพิพาท',
      entries: disputedRows.map((o) => ({
        id: String(o._id),
        text: `ออเดอร์ #${shortId(o._id)} · ${money(o.totalAmount)}`,
        hint: 'รอ Admin ตัดสิน',
        href: o.disputeId ? `/disputes/${o.disputeId}` : '/seller?tab=orders&filter=disputed',
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

router.get('/', auth, async (req, res) => {
  const items =
    req.user.role === 'seller'
      ? await sellerTasks(req.user.id)
      : req.user.role === 'admin'
        ? await adminTasks()
        : await buyerTasks(req.user.id);
  res.json({ total: items.reduce((s, i) => s + i.count, 0), items });
});

module.exports = router;
