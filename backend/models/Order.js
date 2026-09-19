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
      enum: ['PENDING_SHIPMENT', 'SHIPPED', 'COMPLETED', 'CANCELLED'],
      default: 'PENDING_SHIPMENT',
    },
    // สถานะเงินในระบบ Escrow: HELD = ระบบถือไว้, RELEASED = โอนให้ผู้ขายแล้ว, REFUNDED = คืนผู้ซื้อแล้ว
    escrowStatus: { type: String, enum: ['HELD', 'RELEASED', 'REFUNDED'], default: 'HELD' },
    trackingNumber: { type: String, default: '' },
    shippedAt: Date,
    completedAt: Date,
    cancelledAt: Date,
    cancelledBy: { type: String, enum: ['buyer', 'seller', ''], default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', OrderSchema);
