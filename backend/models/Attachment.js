const mongoose = require('mongoose');

/*
 * ไฟล์แนบในแชต (รูปภาพ + เอกสารพื้นฐาน) เก็บในฐานข้อมูลเหมือนรูปโปรไฟล์ (ไม่ต้องใช้แพ็กเกจ/บริการภายนอก)
 * ต่างจาก Image ตรงที่ "ไม่สาธารณะ" — ดาวน์โหลดได้เฉพาะสมาชิกของห้องสนทนา/ข้อพิพาทนั้น (ตรวจสิทธิ์ทุกครั้งที่ GET /api/chat/files/:id)
 * attached = false คือ "อัปโหลดแล้วแต่ยังไม่ได้ส่ง" — ถ้าไม่ถูกส่งภายใน 24 ชม. worker (jobs/imageCleanup.js) จะลบทิ้ง
 */
const AttachmentSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    scopeType: { type: String, enum: ['CONVERSATION', 'DISPUTE'], required: true },
    scopeId: { type: mongoose.Schema.Types.ObjectId, required: true },
    kind: { type: String, enum: ['image', 'file'], required: true },
    mime: { type: String, required: true },
    name: { type: String, required: true, maxlength: 120 },
    size: { type: Number, required: true },
    attached: { type: Boolean, default: false },
    data: { type: Buffer, required: true, select: false },
  },
  { timestamps: true }
);

AttachmentSchema.index({ attached: 1, createdAt: 1 }); // worker เก็บกวาด
AttachmentSchema.index({ ownerId: 1, createdAt: -1 }); // โควตาต่อวัน

module.exports = mongoose.model('Attachment', AttachmentSchema);
