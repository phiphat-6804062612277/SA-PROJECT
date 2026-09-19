const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const auth = require('../middleware/auth');
const { JWT_SECRET } = require('../config');
const { serializeUser, normalizeRole } = require('../utils/helpers');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const signToken = (user) =>
  jwt.sign({ id: user._id, email: user.email, role: normalizeRole(user.role) }, JWT_SECRET, {
    expiresIn: '7d',
  });

// 1. สมัครสมาชิก — เลือกบทบาท buyer | seller ตอนสมัคร
router.post('/register', async (req, res) => {
  const { name, email, password, phone, address, role } = req.body || {};

  if (!name?.trim()) return res.status(400).json({ message: 'กรุณากรอกชื่อ-นามสกุล' });
  if (!EMAIL_RE.test(email || '')) return res.status(400).json({ message: 'รูปแบบอีเมลไม่ถูกต้อง' });
  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
  }
  // ห้ามสมัครเป็น admin ผ่าน API สาธารณะ
  const userRole = role === 'seller' ? 'seller' : 'buyer';

  const normalizedEmail = email.trim().toLowerCase();
  if (await User.findOne({ email: normalizedEmail })) {
    return res.status(400).json({ message: 'อีเมลนี้ถูกใช้งานแล้ว' });
  }

  const hashed = await bcrypt.hash(password, 10);
  let user;
  try {
    user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashed,
      phone: phone?.trim() || '',
      address: address?.trim() || '',
      role: userRole,
    });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'อีเมลนี้ถูกใช้งานแล้ว' });
    throw err;
  }
  await Wallet.create({ userId: user._id, balance: 0 });

  // ล็อกอินให้ทันทีหลังสมัคร
  res.status(201).json({
    message: 'สมัครสมาชิกสำเร็จ',
    token: signToken(user),
    user: serializeUser(user),
  });
});

// 2. เข้าสู่ระบบ
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const user = await User.findOne({ email: String(email || '').trim().toLowerCase() });
  const ok = user && (await bcrypt.compare(String(password || ''), user.password));
  if (!ok) return res.status(400).json({ message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });

  res.json({ token: signToken(user), user: serializeUser(user) });
});

// 3. ดึงข้อมูลโปรไฟล์ตัวเอง
router.get('/me', auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: 'ไม่พบข้อมูลผู้ใช้' });
  res.json(serializeUser(user));
});

// 4. แก้ไขโปรไฟล์
router.put('/profile', auth, async (req, res) => {
  const { name, phone, address } = req.body || {};
  const update = {};
  if (name !== undefined) {
    if (!String(name).trim()) return res.status(400).json({ message: 'ชื่อห้ามว่าง' });
    update.name = String(name).trim();
  }
  if (phone !== undefined) update.phone = String(phone).trim();
  if (address !== undefined) update.address = String(address).trim();

  const user = await User.findByIdAndUpdate(req.user.id, update, { new: true });
  if (!user) return res.status(404).json({ message: 'ไม่พบข้อมูลผู้ใช้' });

  res.json({ message: 'อัปเดตข้อมูลโปรไฟล์เรียบร้อยแล้ว', user: serializeUser(user) });
});

module.exports = router;
