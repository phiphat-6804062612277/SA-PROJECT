const express = require('express');
const router = express.Router();
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');

// ฟังก์ชันดึงข้อมูล Wallet
const getWallet = async (req, res) => {
  try {
    let wallet = await Wallet.findOne({ userId: req.user.id });
    
    if (!wallet) {
      wallet = new Wallet({ userId: req.user.id, balance: 0 });
      await wallet.save();
    }

    const transactions = await Transaction.find({ walletId: wallet._id }).sort({ createdAt: -1 });
    
    // ส่งทั้ง object wallet และ balance แยกออกมาให้ Frontend อ่านง่าย
    res.json({ wallet, balance: wallet.balance, transactions });
  } catch (err) {
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

// รองรับทั้ง /api/wallet และ /api/wallet/me
router.get('/me', auth, getWallet);
router.get('/', auth, getWallet);

// API เติมเงินเข้า Wallet
router.post('/topup', auth, async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'จำนวนเงินต้องมากกว่า 0' });
    }

    let wallet = await Wallet.findOne({ userId: req.user.id });
    if (!wallet) {
      wallet = new Wallet({ userId: req.user.id, balance: 0 });
    }

    wallet.balance += amount;
    await wallet.save();

    const transaction = new Transaction({
      walletId: wallet._id,
      type: 'TOPUP',
      amount,
      description: 'เติมเงินเข้า Wallet'
    });
    await transaction.save();

    res.json({ message: 'เติมเงินสำเร็จ', balance: wallet.balance });
  } catch (err) {
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

module.exports = router;