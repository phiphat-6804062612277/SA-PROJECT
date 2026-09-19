const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema(
  {
    walletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', required: true, index: true },
    type: {
      type: String,
      // TOPUP/REFUND/RECEIVE_PAYMENT = เงินเข้า, PAYMENT/WITHDRAW = เงินออก
      enum: ['TOPUP', 'PAYMENT', 'RECEIVE_PAYMENT', 'REFUND', 'WITHDRAW'],
      required: true,
    },
    amount: { type: Number, required: true },
    description: { type: String, default: '' },
    referenceOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Transaction', TransactionSchema);
