const mongoose = require('mongoose');

/*
 * ห้องสนทนา (Chat) — 2 ประเภท
 *   DIRECT  = ผู้ซื้อ ↔ ร้านค้า/ผู้ขาย   (ownerId = ผู้ซื้อ, peerId = ผู้ขาย) — 1 คู่ต่อ 1 ห้อง
 *   SUPPORT = ผู้ใช้ (ผู้ซื้อ/ผู้ขาย) ↔ ทีม Admin  (ownerId = ผู้ใช้, peerId = null = ทีม Admin ทุกคน) — 1 ผู้ใช้ต่อ 1 ห้อง
 *             ใช้ได้แม้บัญชีถูกแบน (topic = APPEAL คือการยื่นอุทธรณ์)
 * ทุกห้องมีสถานะ OPEN / CLOSED (ห้องถูกปิด = อ่านอย่างเดียว) — แชตข้อพิพาทปิดอัตโนมัติเมื่อ Admin ตัดสิน
 * แชตของข้อพิพาท (Dispute) ยังเก็บในเอกสาร Dispute เดิม แต่ใช้ระบบแนบไฟล์เดียวกัน
 */
const ConversationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['DIRECT', 'SUPPORT'], required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    peerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isSupportChat: { type: Boolean, default: false },

    // เฉพาะ SUPPORT: HELP = ขอความช่วยเหลือทั่วไป, APPEAL = ยื่นอุทธรณ์ (บัญชี/ร้านถูกระงับ)
    topic: { type: String, enum: ['HELP', 'APPEAL'], default: 'HELP' },
    // สถานะห้อง (ทุกประเภท): CLOSED = อ่านได้อย่างเดียว ส่งข้อความเพิ่มไม่ได้ — สมาชิกในห้อง (ผู้ซื้อ/ผู้ขาย/Admin) กดปิดหรือเปิดใหม่ได้จาก PUT /api/chat/conversations/:id/status
    status: { type: String, enum: ['OPEN', 'CLOSED'], default: 'OPEN' },
    closedAt: { type: Date, default: null },
    closedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    closedBySide: { type: String, enum: ['owner', 'peer', 'admin', null], default: null },
    closedByRole: { type: String, enum: ['buyer', 'seller', 'admin', null], default: null },

    // เฉพาะ DIRECT: สินค้า/ออเดอร์ที่กำลังสอบถามอยู่ (อัปเดตทุกครั้งที่เปิดแชตจากสินค้า/ออเดอร์ใหม่)
    context: {
      kind: { type: String, enum: ['product', 'order'] },
      refId: { type: mongoose.Schema.Types.ObjectId },
      label: { type: String, maxlength: 120 },
      imageUrl: { type: String, maxlength: 1000 },
    },

    messageCount: { type: Number, default: 0 },
    lastMessageAt: { type: Date, default: Date.now, index: true },
    lastMessage: {
      preview: { type: String, maxlength: 120 },
      at: Date,
      bySide: { type: String, enum: ['owner', 'peer'] },
    },
    // จำนวนข้อความที่ยังไม่ได้อ่านของแต่ละฝั่ง (peer ของ SUPPORT = ทีม Admin รวมกัน)
    unreadOwner: { type: Number, default: 0 },
    unreadPeer: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// ผู้ซื้อ 1 คน + ร้าน 1 ร้าน = 1 ห้อง / ผู้ใช้ 1 คน = 1 ห้องซัพพอร์ต
ConversationSchema.index({ ownerId: 1, peerId: 1 }, { unique: true, partialFilterExpression: { type: 'DIRECT' } });
ConversationSchema.index({ ownerId: 1 }, { unique: true, partialFilterExpression: { type: 'SUPPORT' } });
ConversationSchema.index({ peerId: 1, lastMessageAt: -1 });
ConversationSchema.index({ type: 1, status: 1, lastMessageAt: -1 });

module.exports = mongoose.model('Conversation', ConversationSchema);
