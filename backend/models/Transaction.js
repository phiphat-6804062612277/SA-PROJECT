const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema(
  {
    walletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', required: true, index: true },
    type: {
      type: String,
      // TOPUP/REFUND/RECEIVE_PAYMENT/AUTO_RELEASE = เงินเข้า, PAYMENT/WITHDRAW = เงินออก
      // AUTO_RELEASE = ระบบปล่อยเงินอัตโนมัติให้ผู้ขายเมื่อครบกำหนดหลังจัดส่ง
      enum: ['TOPUP', 'PAYMENT', 'RECEIVE_PAYMENT', 'AUTO_RELEASE', 'REFUND', 'WITHDRAW'],
      required: true,
    },
    amount: { type: Number, required: true },
    description: { type: String, default: '' },
    referenceOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    // true = บันทึกรายการเงินเข้าแล้วแต่ยังไม่ได้บวกยอดเข้า Wallet (เช่นเซิร์ฟเวอร์ดับกลางทาง) — Worker จะบวกให้ภายหลัง
    pendingApply: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

// 1 ออเดอร์มีรายการเงินแต่ละประเภทได้ครั้งเดียว (PAYMENT / RECEIVE_PAYMENT / AUTO_RELEASE / REFUND) → จ่าย/คืนเงินซ้ำไม่ได้
TransactionSchema.index(
  { referenceOrderId: 1, type: 1 },
  { unique: true, partialFilterExpression: { referenceOrderId: { $type: 'objectId' } } }
);

module.exports = mongoose.model('Transaction', TransactionSchema);
