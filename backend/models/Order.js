const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema(
  {
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        // เก็บ snapshot ไว้ เผื่อผู้ขายแก้ไข/ซ่อนสินค้าภายหลัง
        name: { type: String, default: '' },
        imageUrl: { type: String, default: '' },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
      },
    ],
    totalAmount: { type: Number, required: true },
    shippingName: { type: String, default: '' },
    shippingPhone: { type: String, default: '' },
    shippingAddress: { type: String, default: '' },
    status: {
      type: String,
      // PENDING_SHIPMENT → SHIPPED → COMPLETED (ผู้ซื้อยืนยัน/ครบ 7 วันอัตโนมัติ/Admin ตัดสินให้ผู้ขาย)
      //                       └→ DISPUTED (ผู้ซื้อเปิดข้อพิพาท เงินถูก Freeze) → COMPLETED | REFUNDED (Admin ตัดสิน)
      // CANCELLED = ยกเลิกก่อนจัดส่ง
      enum: ['PENDING_SHIPMENT', 'SHIPPED', 'COMPLETED', 'DISPUTED', 'CANCELLED', 'REFUNDED'],
      default: 'PENDING_SHIPMENT',
    },
    // สถานะเงินในระบบ Escrow: HELD = ระบบถือไว้, RELEASED = โอนให้ผู้ขายแล้ว, REFUNDED = คืนผู้ซื้อแล้ว
    escrowStatus: { type: String, enum: ['HELD', 'RELEASED', 'REFUNDED'], default: 'HELD' },
    // เลขพัสดุ (ตัวพิมพ์ใหญ่ ไม่มีช่องว่าง) — ห้ามซ้ำกับออเดอร์อื่น (unique index แบบ partial ข้ามค่าว่าง) และแก้ไขไม่ได้หลังบันทึก
    trackingNumber: { type: String, default: '' },
    shippedAt: Date,
    // ครบกำหนดปล่อยเงินอัตโนมัติ = shippedAt + AUTO_RELEASE_DAYS (ยกเลิกเป็น null เมื่อเปิดข้อพิพาท)
    autoReleaseAt: { type: Date, default: null },
    disputedAt: Date,
    disputeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dispute' },
    // ใครเป็นคนปล่อยเงิน: buyer = ผู้ซื้อกดยืนยัน, auto = ระบบครบกำหนด, admin = Admin ตัดสิน
    releasedBy: { type: String, enum: ['buyer', 'auto', 'admin', ''], default: '' },
    refundedAt: Date,
    // true = จ่าย/คืนเงินตามสถานะ Escrow เรียบร้อยแล้ว (false = เปลี่ยนสถานะแล้วแต่ยังไม่ได้จ่าย → Worker จะทำให้จบ)
    settled: { type: Boolean, default: false },
    completedAt: Date,
    cancelledAt: Date,
    cancelledBy: { type: String, enum: ['buyer', 'seller', ''], default: '' },
  },
  { timestamps: true }
);

// เลขพัสดุห้ามซ้ำ (ข้ามออเดอร์ที่ยังไม่มีเลขพัสดุ)
OrderSchema.index(
  { trackingNumber: 1 },
  { unique: true, partialFilterExpression: { trackingNumber: { $gt: '' } } }
);
// ใช้โดย Worker ปล่อยเงินอัตโนมัติ
OrderSchema.index({ status: 1, autoReleaseAt: 1 });
OrderSchema.index({ settled: 1, escrowStatus: 1 });

module.exports = mongoose.model('Order', OrderSchema);
