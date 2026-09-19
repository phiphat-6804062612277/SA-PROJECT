const mongoose = require('mongoose');

const WalletSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    balance: { type: Number, default: 0, min: 0 },
    // id ของ Transaction (รายการเงินเข้า) ที่บวกเข้ายอดแล้ว — กันบวกซ้ำเวลาทำซ้ำ/กู้คืน (เก็บล่าสุด 1,000 รายการ, ไม่ส่งออกไป client)
    applied: { type: [mongoose.Schema.Types.ObjectId], default: undefined, select: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Wallet', WalletSchema);
