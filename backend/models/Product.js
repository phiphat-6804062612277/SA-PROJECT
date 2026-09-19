const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema(
  {
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: '', maxlength: 1000 },
    price: { type: Number, required: true, min: 0, max: 10000000 },
    stock: { type: Number, required: true, default: 0, min: 0, max: 100000 },
    imageUrl: { type: String, default: '' },
    // true = แสดงในหน้าร้านของผู้ขายด้วย, false = ขายในตลาดรวมเท่านั้น (นอกร้าน)
    inStore: { type: Boolean, default: true },
    // ผู้ขาย/Admin กด "ลบสินค้า" = ซ่อน (ไม่ลบจริง) เพื่อไม่ให้ประวัติ Order เสียหาย
    isActive: { type: Boolean, default: true },
    removedByAdmin: { type: Boolean, default: false },
    // เจ้าของถูกแบน หรือร้านถูกแบน → ระงับการขายชั่วคราว
    suspended: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Product', ProductSchema);
