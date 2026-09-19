const mongoose = require('mongoose');

// รูปภาพที่ผู้ใช้อัปโหลด (เก็บในฐานข้อมูลเพื่อไม่ต้องพึ่งบริการภายนอก/แพ็กเกจเพิ่ม) — เสิร์ฟผ่าน GET /api/images/:id
const ImageSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // avatar = รูปโปรไฟล์, logo = โลโก้ร้าน, banner = ปกร้าน, review = รูปประกอบรีวิว
    kind: { type: String, enum: ['avatar', 'logo', 'banner', 'review'], required: true },
    mime: { type: String, enum: ['image/jpeg', 'image/png', 'image/webp'], required: true },
    size: { type: Number, required: true },
    data: { type: Buffer, required: true, select: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Image', ImageSchema);
