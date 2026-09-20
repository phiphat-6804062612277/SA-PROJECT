const User = require('../models/User');
const { normalizeRole } = require('./helpers');

// ฟิลด์ผู้ใช้ที่ใช้แสดงในแชต
const PEOPLE_FIELDS = 'name email role avatarUrl storeName storeLogoUrl isBanned banReason storeBanned storeBanReason';

const SUPPORT_NAME = 'ทีมงาน Solify (Admin)';

// ฝั่งของผู้ใช้ในห้อง: owner = ผู้ซื้อ (DIRECT) / ผู้ใช้ที่ติดต่อ Admin (SUPPORT), peer = ผู้ขาย (DIRECT), admin = ทีม Admin (SUPPORT)
function sideOf(conv, user) {
  if (conv.type === 'SUPPORT' && user.role === 'admin') return 'admin';
  if (String(conv.ownerId) === user.id) return 'owner';
  if (conv.type === 'DIRECT' && String(conv.peerId) === user.id) return 'peer';
  return null;
}

// ผู้ขายแสดงเป็น "ร้านค้า" (ชื่อร้าน + โลโก้) ผู้ซื้อ/Admin แสดงเป็นชื่อ + รูปโปรไฟล์
function personView(u) {
  if (!u) return { id: null, name: 'ผู้ใช้ที่ถูกลบ', avatarUrl: '', role: 'buyer' };
  const role = normalizeRole(u.role);
  const seller = role === 'seller';
  return {
    id: u._id,
    name: (seller ? u.storeName || u.name : u.name) || '-',
    avatarUrl: (seller ? u.storeLogoUrl || u.avatarUrl : u.avatarUrl) || '',
    role,
  };
}

// โหลดผู้ใช้หลายคนพร้อมกัน → Map(id → user)
async function loadPeople(ids) {
  const list = [...new Set(ids.filter(Boolean).map(String))];
  const users = list.length ? await User.find({ _id: { $in: list } }).select(PEOPLE_FIELDS) : [];
  return new Map(users.map((u) => [String(u._id), u]));
}

// ข้อความตัวอย่างในรายการห้อง
function previewOf({ text, messageType, fileName }) {
  if (text) return String(text).replace(/\s+/g, ' ').slice(0, 80);
  if (messageType === 'IMAGE') return '📷 รูปภาพ';
  if (messageType === 'FILE') return `📎 ${fileName || 'ไฟล์แนบ'}`.slice(0, 80);
  return '';
}

// ส่งข้อความได้ไหม — ห้องที่ถูกปิด (CLOSED) ส่งไม่ได้ทุกประเภท (อ่านอย่างเดียว จนกว่าจะเปิดใหม่)
// DIRECT: ห้ามส่งหาบัญชีที่ถูกแบน (ร้านที่ "ถูกระงับร้านอย่างเดียว" ยังตอบลูกค้าเดิมได้) / SUPPORT: ส่งได้เสมอ (รวมผู้ที่ถูกแบน)
const CLOSED_REASON = 'การสนทนานี้ถูกปิดแล้ว';
function sendability(conv, side, people) {
  if (conv.status === 'CLOSED') return { canSend: false, reason: CLOSED_REASON };
  if (conv.type === 'SUPPORT') return { canSend: true, reason: '' };
  const other = people.get(String(side === 'owner' ? conv.peerId : conv.ownerId));
  if (!other) return { canSend: false, reason: 'ไม่พบบัญชีของอีกฝ่ายแล้ว' };
  if (other.isBanned) return { canSend: false, reason: 'บัญชีของอีกฝ่ายถูกระงับ ไม่สามารถส่งข้อความได้' };
  return { canSend: true, reason: '' };
}

const contextView = (conv, side) => {
  const c = conv.context;
  if (!c || !c.kind) return null;
  let href = null;
  if (c.kind === 'product') href = `/product/${c.refId}`;
  else if (c.kind === 'order') href = side === 'owner' ? '/history' : side === 'peer' ? '/seller/orders' : null;
  return { kind: c.kind, refId: c.refId, label: c.label || '', imageUrl: c.imageUrl || '', href };
};

// รูปแบบห้องที่ส่งให้ client ตามมุมมองของผู้ดู (side)
function conversationView(conv, side, people, viewerId) {
  const owner = people.get(String(conv.ownerId));
  const peer = conv.peerId ? people.get(String(conv.peerId)) : null;

  let counterpart;
  if (conv.type === 'SUPPORT') {
    counterpart = side === 'admin' ? personView(owner) : { id: null, name: SUPPORT_NAME, avatarUrl: '', role: 'admin' };
  } else {
    counterpart = personView(side === 'owner' ? peer : owner);
  }

  const last = conv.lastMessage && conv.lastMessage.at ? conv.lastMessage : null;
  const view = {
    id: conv._id,
    type: conv.type,
    isSupportChat: !!conv.isSupportChat,
    topic: conv.type === 'SUPPORT' ? conv.topic : null,
    status: conv.status || 'OPEN',
    closedAt: conv.status === 'CLOSED' ? conv.closedAt || null : null,
    // ใครปิดห้อง (mine = เราเป็นคนปิดเอง) — ใช้แสดงใน Banner "การสนทนานี้ถูกปิดแล้ว"
    // mine: เทียบด้วยรหัสผู้ใช้ (Admin หลายคนใช้ฝั่ง 'admin' เดียวกัน จึงเทียบฝั่งอย่างเดียวไม่ได้) — ห้องเก่าที่ไม่มี closedById ใช้ฝั่งแทน
    closedBy:
      conv.status === 'CLOSED' && conv.closedBySide
        ? { role: conv.closedByRole || null, mine: conv.closedById && viewerId ? String(conv.closedById) === String(viewerId) : conv.closedBySide === side }
        : null,
    side,
    counterpart,
    context: contextView(conv, side),
    unread: side === 'owner' ? conv.unreadOwner || 0 : conv.unreadPeer || 0,
    messageCount: conv.messageCount || 0,
    lastMessage: last
      ? { preview: last.preview || '', at: last.at, fromMe: (side === 'owner') === (last.bySide === 'owner') }
      : null,
    lastMessageAt: conv.lastMessageAt,
    createdAt: conv.createdAt,
  };

  const s = sendability(conv, side, people);
  view.canSend = s.canSend;
  view.blockedReason = s.reason;

  // ผู้ใช้ที่ติดต่อ Admin เห็นสถานะบัญชีของตัวเอง (หน้าแจ้งเตือนถูกระงับใช้เช็คว่าถูกปลดแบนหรือยัง) / Admin เห็นข้อมูลผู้ใช้ + สถานะแบน
  if (conv.type === 'SUPPORT' && owner) {
    const info = {
      id: owner._id,
      name: owner.name,
      storeName: owner.storeName || '',
      role: normalizeRole(owner.role),
      isBanned: !!owner.isBanned,
      banReason: owner.banReason || '',
      storeBanned: !!owner.storeBanned,
      storeBanReason: owner.storeBanReason || '',
    };
    if (side === 'admin') view.owner = { ...info, email: owner.email, avatarUrl: owner.avatarUrl || '' };
    else if (side === 'owner') view.account = info;
  }
  return view;
}

// รูปแบบข้อความที่ส่งให้ client
function messageView(m, conv, side, people) {
  const fromOwner = String(m.senderId) === String(conv.ownerId);
  const sender = people.get(String(m.senderId));
  const p = personView(sender);
  // ฝั่ง Admin ในห้องซัพพอร์ตเป็นทีมเดียวกัน: ผู้ใช้เห็นเป็น "Admin" — ทีมงานด้วยกันเห็นชื่อจริงของ Admin ที่ตอบ
  const name = m.senderRole === 'admin' && side !== 'admin' ? 'Admin' : p.name;
  return {
    id: m._id,
    senderId: m.senderId,
    senderRole: m.senderRole,
    senderName: name,
    senderAvatarUrl: p.avatarUrl,
    mine: (side === 'owner') === fromOwner,
    messageType: m.messageType || 'TEXT',
    text: m.text || '',
    fileUrl: m.fileUrl || '',
    fileName: m.fileName || '',
    fileMime: m.fileMime || '',
    fileSize: m.fileSize || 0,
    isSupportChat: !!m.isSupportChat,
    createdAt: m.createdAt,
  };
}

module.exports = {
  SUPPORT_NAME,
  CLOSED_REASON,
  sideOf,
  personView,
  loadPeople,
  previewOf,
  sendability,
  conversationView,
  messageView,
};
