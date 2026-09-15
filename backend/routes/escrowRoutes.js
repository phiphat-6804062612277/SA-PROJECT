const express = require('express');
const router = express.Router();
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');

// GET /api/escrow/test
router.get('/test', (req, res) => {
  res.send('Escrow Route Works!');
});

// POST /api/escrow/checkout
// ⚠️ ระวัง: ตรงนี้ต้องใช้ '/checkout' เท่านั้น ห้ามใส่ /escrow/checkout ซ้ำ
router.post('/checkout', auth, async (req, res) => {
  try {
    const { totalAmount } = req.body;
    const amount = Number(totalAmount);

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'ยอดชำระเงินไม่ถูกต้อง' });
    }

    // 1. ดึงข้อมูล Wallet
    let wallet = await Wallet.findOne({ userId: req.user.id });
    if (!wallet || wallet.balance < amount) {
      return res.status(400).json({ message: 'ยอดเงินคงเหลือใน Wallet ไม่เพียงพอ' });
    }

    // 2. หักเงินออก
    wallet.balance -= amount;
    await wallet.save();

    // 3. บันทึกประวัติ Transaction
    const transaction = new Transaction({
      walletId: wallet._id,
      type: 'PAYMENT',
      amount: amount,
      description: 'ชำระค่าสินค้า (ถือเงินระบบ Escrow)'
    });
    await transaction.save();

    res.json({ message: 'ชำระเงินสำเร็จ', balance: wallet.balance });
  } catch (err) {
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

module.exports = router;