const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema(
  {
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole: { type: String, enum: ['buyer', 'seller', 'admin'], required: true },
    text: { type: String, required: true, trim: true, maxlength: 500 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const DisputeSchema = new mongoose.Schema(
  {
    // 1 ออเดอร์เปิดข้อพิพาทได้ครั้งเดียว
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reason: { type: String, required: true, trim: true, maxlength: 1000 },
    evidenceImages: { type: [String], default: [] }, // URL รูปหลักฐาน
    // ยอดเงินที่ถูก Freeze ไว้ตอนเปิดข้อพิพาท
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'RESOLVED_REFUND_BUYER', 'RESOLVED_PAY_SELLER', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    adminNote: { type: String, default: '', maxlength: 1000 },
    resolvedAt: Date,
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // ประวัติการติดต่อระหว่างคู่กรณี (และ Admin) ขณะยังไม่ตัดสิน
    messages: { type: [MessageSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Dispute', DisputeSchema);
