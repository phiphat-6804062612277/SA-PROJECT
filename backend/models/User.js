const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    phone: { type: String, default: '' },
    address: { type: String, default: '', maxlength: 500 },
    role: { type: String, enum: ['buyer', 'seller', 'admin'], default: 'buyer' },

    // รูปโปรไฟล์ (path ของรูปที่อัปโหลด เช่น /api/images/<id>) — ทุกบทบาท
    avatarUrl: { type: String, default: '' },

    // ร้านค้า (ใช้เมื่อ role = seller)
    storeName: { type: String, default: '', trim: true, maxlength: 60 },
    storeDescription: { type: String, default: '', maxlength: 300 },
    storeLogoUrl: { type: String, default: '' }, // โลโก้ร้าน
    storeBannerUrl: { type: String, default: '' }, // ปก/แบนเนอร์ร้าน

    // การแบนโดย Admin: แบนบัญชี (เข้าสู่ระบบไม่ได้) และ/หรือ แบนเฉพาะร้านค้า (สินค้าถูกซ่อน ขายไม่ได้)
    isBanned: { type: Boolean, default: false },
    banReason: { type: String, default: '' },
    storeBanned: { type: Boolean, default: false },
    storeBanReason: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
