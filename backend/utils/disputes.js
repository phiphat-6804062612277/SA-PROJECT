const Order = require('../models/Order');
const User = require('../models/User');

const STATUS_TEXT = {
  PENDING: 'รอ Admin พิจารณา',
  RESOLVED_REFUND_BUYER: 'Admin ตัดสิน: คืนเงินให้ผู้ซื้อ',
  RESOLVED_PAY_SELLER: 'Admin ตัดสิน: โอนเงินให้ผู้ขาย',
  REJECTED: 'Admin ปฏิเสธคำร้อง (ดำเนินการซื้อขายต่อ)',
};

const RESOLVED_STATUSES = ['RESOLVED_REFUND_BUYER', 'RESOLVED_PAY_SELLER', 'REJECTED'];

const partyName = (u) => (u ? u.storeName || u.name : '-');

// รายละเอียดข้อพิพาทสำหรับแสดงผล — includeContact = true เฉพาะ Admin (เห็นอีเมล/เบอร์ของคู่กรณี)
async function buildDetail(dispute, { includeContact = false } = {}) {
  const adminIds = [...new Set((dispute.messages || []).filter((m) => m.senderRole === 'admin').map((m) => String(m.senderId)))];
  const [order, buyer, seller, admins] = await Promise.all([
    Order.findById(dispute.orderId),
    User.findById(dispute.buyerId).select('name email phone avatarUrl'),
    User.findById(dispute.sellerId).select('name email phone storeName storeLogoUrl avatarUrl'),
    adminIds.length ? User.find({ _id: { $in: adminIds } }).select('avatarUrl') : [],
  ]);
  const adminAvatar = new Map(admins.map((a) => [String(a._id), a.avatarUrl || '']));

  // รูปประจำตัวในห้องแชต: ผู้ซื้อ = avatar, ผู้ขาย = โลโก้ร้าน (ถ้าไม่มีใช้ avatar), Admin = avatar ของ Admin คนที่ส่ง
  const buyerAvatar = buyer?.avatarUrl || '';
  const sellerAvatar = seller?.storeLogoUrl || seller?.avatarUrl || '';

  const nameOf = (role) =>
    role === 'buyer' ? buyer?.name || 'ผู้ซื้อ' : role === 'seller' ? partyName(seller) : 'Admin';

  const contact = (u) => (includeContact && u ? { email: u.email, phone: u.phone || '' } : {});

  const timeline = [];
  if (order) {
    timeline.push({ at: order.createdAt, text: 'ผู้ซื้อสั่งซื้อและชำระเงิน — ระบบ Escrow ถือเงินไว้' });
    if (order.shippedAt) {
      timeline.push({ at: order.shippedAt, text: `ผู้ขายจัดส่งสินค้า (เลขพัสดุ ${order.trackingNumber || '-'})` });
    }
  }
  timeline.push({ at: dispute.createdAt, text: 'ผู้ซื้อเปิดข้อพิพาท — เงินถูก Freeze และยกเลิกการปล่อยเงินอัตโนมัติ' });
  if (dispute.resolvedAt) timeline.push({ at: dispute.resolvedAt, text: STATUS_TEXT[dispute.status] });

  return {
    id: dispute._id,
    orderId: dispute.orderId,
    status: dispute.status,
    statusText: STATUS_TEXT[dispute.status],
    reason: dispute.reason,
    evidenceImages: dispute.evidenceImages || [],
    amount: dispute.amount,
    adminNote: dispute.adminNote || '',
    resolvedAt: dispute.resolvedAt || null,
    createdAt: dispute.createdAt,
    buyer: { id: dispute.buyerId, name: buyer?.name || '-', avatarUrl: buyerAvatar, ...contact(buyer) },
    seller: {
      id: dispute.sellerId,
      name: seller?.name || '-',
      storeName: seller?.storeName || '',
      avatarUrl: sellerAvatar,
      ...contact(seller),
    },
    order: order && {
      id: order._id,
      status: order.status,
      escrowStatus: order.escrowStatus,
      items: order.items,
      totalAmount: order.totalAmount,
      trackingNumber: order.trackingNumber,
      shippedAt: order.shippedAt || null,
      disputedAt: order.disputedAt || null,
      shippingName: order.shippingName,
      shippingAddress: order.shippingAddress,
      createdAt: order.createdAt,
    },
    messages: (dispute.messages || []).map((m) => ({
      id: m._id,
      senderRole: m.senderRole,
      senderName: nameOf(m.senderRole),
      senderAvatarUrl:
        m.senderRole === 'buyer' ? buyerAvatar : m.senderRole === 'seller' ? sellerAvatar : adminAvatar.get(String(m.senderId)) || '',
      text: m.text,
      createdAt: m.createdAt,
    })),
    timeline,
  };
}

module.exports = { buildDetail, STATUS_TEXT, RESOLVED_STATUSES };
