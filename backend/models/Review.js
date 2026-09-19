const mongoose = require('mongoose');

// รีวิวหลังคำสั่งซื้อสำเร็จ (COMPLETED): ผู้ซื้อรีวิวผู้ขาย และผู้ขายรีวิวผู้ซื้อ ได้ฝั่งละ 1 ครั้งต่อ 1 Order
const ReviewSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    type: { type: String, enum: ['BUYER_TO_SELLER', 'SELLER_TO_BUYER'], required: true },
    reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    revieweeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '', maxlength: 500 },
    // รูปประกอบรีวิว (path ของรูปที่ผู้ซื้ออัปโหลด เช่น /api/images/<id>) — เฉพาะรีวิวของผู้ซื้อ สูงสุด 4 รูป
    images: { type: [String], default: [], validate: [(v) => v.length <= 4, 'แนบรูปได้ไม่เกิน 4 รูป'] },
    // สินค้าในออเดอร์ (ใช้แสดงรีวิวในหน้าสินค้า)
    productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product', index: true }],
  },
  { timestamps: true }
);

ReviewSchema.index({ orderId: 1, type: 1 }, { unique: true });
ReviewSchema.index({ productIds: 1, type: 1, createdAt: -1 }); // หน้ารีวิวสินค้า

module.exports = mongoose.model('Review', ReviewSchema);
