const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema(
  {
    // ร้านค้าเจ้าของสินค้า — ในระบบนี้ 1 ร้าน = 1 บัญชีผู้ขาย จึงใช้รหัสผู้ขายเป็นรหัสร้าน (`/api/stores/:sellerId`)
    // สินค้าทุกชิ้นต้องผูกกับร้านของผู้ขายที่สร้างเสมอ: เซิร์ฟเวอร์กำหนดค่านี้จาก token เอง (ไม่รับจาก body) และเปลี่ยนภายหลังไม่ได้ (immutable)
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: '', maxlength: 1000 },
    price: { type: Number, required: true, min: 0, max: 10000000 },
    stock: { type: Number, required: true, default: 0, min: 0, max: 100000 },
    imageUrl: { type: String, default: '' },
    // ผู้ขาย/Admin กด "ลบสินค้า" = ซ่อน (ไม่ลบจริง) เพื่อไม่ให้ประวัติ Order เสียหาย
    isActive: { type: Boolean, default: true },
    removedByAdmin: { type: Boolean, default: false },
    // เจ้าของถูกแบน หรือร้านถูกแบน → ระงับการขายชั่วคราว
    suspended: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Product', ProductSchema);
