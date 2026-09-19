const express = require('express');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');
const { credit, debitIfEnough } = require('../utils/wallet');

const router = express.Router();

// Admin ไม่มี Wallet — งานของ Admin คือไกล่เกลี่ยข้อพิพาท (/api/admin/disputes)
router.use(auth, (req, res, next) => {
  if (req.user.role === 'admin') {
    return res.status(403).json({ message: 'บัญชี Admin ไม่มี Wallet (ใช้หน้าจัดการข้อพิพาทแทน)' });
  }
  next();
});

const MAX_TOPUP = 100000; // เพดานต่อครั้ง (ระบบจำลอง)

async function getWallet(req, res) {
  const wallet = await Wallet.findOneAndUpdate(
    { userId: req.user.id },
    { $setOnInsert: { balance: 0 } },
    { new: true, upsert: true }
  );
  const transactions = await Transaction.find({ walletId: wallet._id }).sort({ createdAt: -1 }).limit(100);

  // ส่งทั้ง wallet และ balance แยกออกมาเพื่อให้ frontend อ่านง่าย
  res.json({ wallet, balance: wallet.balance, transactions });
}

router.get('/', getWallet);
router.get('/me', getWallet);

// เติมเงิน (จำลอง — ไม่ได้ต่อ Payment Gateway จริง)
router.post('/topup', async (req, res) => {
  // ผู้ขายเติมเงินไม่ได้ — Wallet ผู้ขายมีเงินเข้าจากการขายเท่านั้น และมีแต่ฟังก์ชันถอน
  if (req.user.role === 'seller') {
    return res.status(403).json({ message: 'บัญชีผู้ขายไม่สามารถเติมเงินได้ (ถอนเงินรายได้ได้เท่านั้น)' });
  }
  const amount = Number(req.body?.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ message: 'จำนวนเงินต้องมากกว่า 0' });
  }
  if (amount > MAX_TOPUP) {
    return res.status(400).json({ message: `เติมเงินได้ไม่เกิน ${MAX_TOPUP.toLocaleString('th-TH')} บาทต่อครั้ง` });
  }

  const wallet = await credit(req.user.id, amount, { type: 'TOPUP', description: 'เติมเงินเข้า Wallet' });
  res.json({ message: 'เติมเงินสำเร็จ', balance: wallet.balance });
});

// ถอนเงิน (จำลอง) — เฉพาะผู้ขาย ใช้ถอนรายได้ที่ได้รับจากการขาย
router.post('/withdraw', auth.requireRole('seller'), async (req, res) => {
  const amount = Number(req.body?.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ message: 'จำนวนเงินต้องมากกว่า 0' });
  }

  const wallet = await debitIfEnough(req.user.id, amount);
  if (!wallet) return res.status(400).json({ message: 'ยอดเงินคงเหลือไม่เพียงพอ' });

  await Transaction.create({
    walletId: wallet._id,
    type: 'WITHDRAW',
    amount,
    description: 'ถอนเงินออกจาก Wallet',
  });
  res.json({ message: 'ถอนเงินสำเร็จ', balance: wallet.balance });
});

module.exports = router;
