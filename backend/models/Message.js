const mongoose = require('mongoose');

// ข้อความในห้องสนทนา (Conversation) — ข้อความล้วน / รูปภาพ / ไฟล์เอกสาร (ไฟล์เก็บใน Attachment เสิร์ฟผ่าน GET /api/chat/files/:id)
const MessageSchema = new mongoose.Schema(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole: { type: String, enum: ['buyer', 'seller', 'admin'], required: true },
    // ผู้รับ: ผู้ใช้อีกฝั่ง — null = ทีม Admin (ผู้ใช้ส่งถึง Admin) ; ห้องเดียวกันมี conversationId อยู่แล้ว ใช้ receiverId เพื่ออ่านง่าย/สืบค้นย้อนหลัง
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    messageType: { type: String, enum: ['TEXT', 'IMAGE', 'FILE'], default: 'TEXT' },
    text: { type: String, default: '', trim: true, maxlength: 1000 }, // คำบรรยายใต้ไฟล์ได้ (ว่างได้ถ้ามีไฟล์)
    fileUrl: { type: String, default: '' }, // /api/chat/files/<id>
    fileName: { type: String, default: '' },
    fileMime: { type: String, default: '' },
    fileSize: { type: Number, default: 0 },
    // true = ข้อความในแชตติดต่อ Admin / ยื่นอุทธรณ์
    isSupportChat: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

MessageSchema.index({ conversationId: 1, _id: -1 }); // โหลดข้อความล่าสุด/เลื่อนย้อนหลัง/ดึงเฉพาะที่ใหม่กว่า
MessageSchema.index({ senderId: 1, createdAt: -1 }); // จำกัดความถี่การส่ง

module.exports = mongoose.model('Message', MessageSchema);
