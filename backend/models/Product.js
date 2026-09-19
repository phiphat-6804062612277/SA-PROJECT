const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema(
  {
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, default: 0, min: 0 },
    imageUrl: { type: String, default: '' },
    // ผู้ขายกด "ลบสินค้า" = ซ่อน (ไม่ลบจริง) เพื่อไม่ให้ประวัติ Order เสียหาย
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Product', ProductSchema);
