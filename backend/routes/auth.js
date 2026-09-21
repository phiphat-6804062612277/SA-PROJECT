const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const PasswordReset = require('../models/PasswordReset');
const auth = require('../middleware/auth');
const { JWT_SECRET, ADMIN_SIGNUP_CODE, OTP_DEMO_MODE } = require('../config');
const { serializeUser, normalizeRole, LIMITS } = require('../utils/helpers');
const { validatePhone } = require('../utils/phone');
const { sendOtpEmail } = require('../utils/mailer');
const { checkImageField, discardImage } = require('../utils/images');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// sid = รหัสเซสชันล่าสุดของบัญชี (User.sessionId) — Single Active Session: ล็อกอินใหม่ทุกครั้งสุ่ม sid ใหม่ ทำให้โทเคนของเครื่องเดิมใช้ไม่ได้ทันที
const newSessionId = () => crypto.randomBytes(16).toString('hex');

const signToken = (user, sid) =>
  jwt.sign({ id: user._id, email: user.email, role: normalizeRole(user.role), sid }, JWT_SECRET, {
    expiresIn: '7d',
  });

// ล็อกอินด้วยรหัสผ่านถูกต้องแต่บัญชีถูกแบน: ไม่ออก token ปกติ แต่ออก appealToken (อายุสั้น) ให้ใช้ "ติดต่อ Admin / ยื่นอุทธรณ์" ได้อย่างเดียว
const bannedResponse = (user) => ({
  ...auth.bannedBody(user),
  appealToken: jwt.sign({ id: user._id, purpose: 'appeal' }, JWT_SECRET, { expiresIn: '12h' }),
});

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// 1. สมัครสมาชิก — เลือกบทบาท buyer | seller | admin (admin ต้องมีรหัสลับ ADMIN_SIGNUP_CODE)
router.post('/register', async (req, res) => {
  const { name, email, password, phone, address, role, adminCode } = req.body || {};

  const username = String(name || '').trim();
  if (!username) return res.status(400).json({ message: 'กรุณากรอกชื่อผู้ใช้' });
  if (username.length > LIMITS.USER_NAME) {
    return res.status(400).json({ message: `ชื่อผู้ใช้ต้องไม่เกิน ${LIMITS.USER_NAME} ตัวอักษร` });
  }
  if (!EMAIL_RE.test(email || '') || String(email).length > 100) {
    return res.status(400).json({ message: 'รูปแบบอีเมลไม่ถูกต้อง' });
  }
  if (typeof password !== 'string' || password.length < 6 || password.length > 72) {
    return res.status(400).json({ message: 'รหัสผ่านต้องมีความยาว 6-72 ตัวอักษร' });
  }
  const phoneCheck = validatePhone(phone);
  if (!phoneCheck.ok) return res.status(400).json({ message: phoneCheck.message });

  let userRole = 'buyer';
  if (role === 'seller') userRole = 'seller';
  if (role === 'admin') {
    if (!ADMIN_SIGNUP_CODE) return res.status(403).json({ message: 'ระบบปิดการสมัครผู้ดูแลระบบ (Admin)' });
    if (!safeEqual(adminCode || '', ADMIN_SIGNUP_CODE)) {
      return res.status(403).json({ message: 'รหัสผู้ดูแลระบบไม่ถูกต้อง' });
    }
    userRole = 'admin';
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (await User.findOne({ email: normalizedEmail })) {
    return res.status(400).json({ message: 'อีเมลนี้ถูกใช้งานแล้ว' });
  }

  const hashed = await bcrypt.hash(password, 10);
  const sid = newSessionId();
  let user;
  try {
    user = await User.create({
      sessionId: sid,
      name: username,
      email: normalizedEmail,
      password: hashed,
      phone: phoneCheck.value,
      address: String(address || '').trim().slice(0, 500),
      role: userRole,
      storeName: userRole === 'seller' ? username : '', // ตั้งชื่อร้านเริ่มต้น แก้ทีหลังได้
    });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'อีเมลนี้ถูกใช้งานแล้ว' });
    throw err;
  }
  if (userRole !== 'admin') await Wallet.create({ userId: user._id, balance: 0 }); // Admin ไม่มี Wallet

  // ล็อกอินให้ทันทีหลังสมัคร
  res.status(201).json({ message: 'สมัครสมาชิกสำเร็จ', token: signToken(user, sid), user: serializeUser(user) });
});

// 2. เข้าสู่ระบบ
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const user = await User.findOne({ email: String(email || '').trim().toLowerCase() });
  const ok = user && (await bcrypt.compare(String(password || ''), user.password));
  if (!ok) return res.status(400).json({ message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
  if (user.isBanned) return res.status(403).json(bannedResponse(user)); // บัญชีที่ถูกแบนไม่ได้เซสชัน จึงไม่ไปแทนที่เซสชันเดิมของใคร

  // Single Active Session: บันทึกเซสชันใหม่ทับของเดิม → เครื่อง/เบราว์เซอร์ที่ล็อกอินไว้ก่อนหน้าจะถูกเด้งออกในคำขอถัดไป (401 SESSION_REPLACED)
  const sid = newSessionId();
  await User.updateOne({ _id: user._id }, { $set: { sessionId: sid } });
  res.json({ token: signToken(user, sid), user: serializeUser(user) });
});

// 2.1 ออกจากระบบ: ล้างเซสชันในฐานข้อมูล → โทเคนที่ถืออยู่ใช้ไม่ได้อีก (ต่อให้ถูกคัดลอกไปไว้ที่อื่น)
// ล้างเฉพาะเมื่อ sessionId ยังเป็นของโทเคนนี้ — ถ้าระหว่างนั้นมีเครื่องอื่นล็อกอินแทนที่แล้ว จะไม่ไปล้างเซสชันใหม่ของเขา
// (allowBanned: ผู้ที่ถูกแบนก็ออกจากระบบได้ / appeal token ไม่มีเซสชันจึงไม่ทำอะไร)
router.post('/logout', auth.allowBanned, async (req, res) => {
  if (req.user.sid) await User.updateOne({ _id: req.user.id, sessionId: req.user.sid }, { $set: { sessionId: '' } });
  res.json({ message: 'ออกจากระบบเรียบร้อยแล้ว' });
});

// 3. ดึงข้อมูลโปรไฟล์ตัวเอง
router.get('/me', auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: 'ไม่พบข้อมูลผู้ใช้' });
  res.json(serializeUser(user));
});

// 4. แก้ไขโปรไฟล์
router.put('/profile', auth, async (req, res) => {
  const { name, phone, address, avatarUrl } = req.body || {};
  const update = {};
  let oldAvatar = '';
  if (name !== undefined) {
    const n = String(name).trim();
    if (!n) return res.status(400).json({ message: 'ชื่อห้ามว่าง' });
    if (n.length > LIMITS.USER_NAME) {
      return res.status(400).json({ message: `ชื่อต้องไม่เกิน ${LIMITS.USER_NAME} ตัวอักษร` });
    }
    update.name = n;
  }
  if (phone !== undefined) {
    const p = validatePhone(phone);
    if (!p.ok) return res.status(400).json({ message: p.message });
    update.phone = p.value;
  }
  if (address !== undefined) {
    const a = String(address).trim();
    if (a.length > 500) return res.status(400).json({ message: 'ที่อยู่ต้องไม่เกิน 500 ตัวอักษร' });
    update.address = a;
  }

  if (avatarUrl !== undefined) {
    const current = await User.findById(req.user.id).select('avatarUrl');
    oldAvatar = current?.avatarUrl || '';
    const check = await checkImageField(avatarUrl, req.user.id, 'avatar', oldAvatar);
    if (!check.ok) return res.status(400).json({ message: check.message });
    update.avatarUrl = check.value;
  }

  const user = await User.findByIdAndUpdate(req.user.id, update, { new: true });
  if (!user) return res.status(404).json({ message: 'ไม่พบข้อมูลผู้ใช้' });
  if (oldAvatar && oldAvatar !== user.avatarUrl) await discardImage(oldAvatar, req.user.id); // ลบรูปเก่าที่ถูกแทนที่

  res.json({ message: 'อัปเดตข้อมูลโปรไฟล์เรียบร้อยแล้ว', user: serializeUser(user) });
});

// ---------------------------------------------------------------------------
// ลืมรหัสผ่าน: (1) ขอ OTP  →  (2) ยืนยัน OTP ได้โทเคนรีเซ็ต  →  (3) ตั้งรหัสผ่านใหม่
// ---------------------------------------------------------------------------
const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;
const MAX_ATTEMPTS = 5;

const hashOtp = (email, otp) => crypto.createHmac('sha256', JWT_SECRET).update(`${email}:${otp}`).digest('hex');

router.post('/forgot-password', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ message: 'รูปแบบอีเมลไม่ถูกต้อง' });

  const generic = { message: 'หากอีเมลนี้มีอยู่ในระบบ เราได้ส่งรหัส OTP 5 หลักให้แล้ว (ใช้ได้ 10 นาที)' };
  const user = await User.findOne({ email });
  if (!user || user.isBanned) return res.json(generic); // ไม่เปิดเผยว่ามีอีเมลนี้หรือไม่

  const existing = await PasswordReset.findOne({ email });
  if (existing && Date.now() - existing.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - existing.lastSentAt.getTime())) / 1000);
    return res.status(429).json({ message: `กรุณารอ ${wait} วินาทีก่อนขอรหัสใหม่` });
  }

  const otp = String(crypto.randomInt(0, 100000)).padStart(5, '0');
  await PasswordReset.findOneAndUpdate(
    { email },
    { otpHash: hashOtp(email, otp), attempts: 0, lastSentAt: new Date(), resetNonce: '', expiresAt: new Date(Date.now() + OTP_TTL_MS) },
    { upsert: true, setDefaultsOnInsert: true }
  );
  await sendOtpEmail(email, otp);

  // โหมดสาธิต: ส่ง OTP กลับไปให้หน้าเว็บแสดงเลย (ปิดตอนใช้งานจริง)
  res.json(OTP_DEMO_MODE ? { ...generic, demoOtp: otp } : generic);
});

router.post('/verify-otp', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const otp = String(req.body?.otp || '').trim();
  const invalid = { message: 'รหัส OTP ไม่ถูกต้องหรือหมดอายุ' };

  const doc = await PasswordReset.findOne({ email });
  if (!doc || !doc.otpHash || doc.expiresAt < new Date()) return res.status(400).json(invalid);
  if (doc.attempts >= MAX_ATTEMPTS) {
    return res.status(429).json({ message: 'กรอกรหัสผิดหลายครั้งเกินไป กรุณาขอรหัส OTP ใหม่' });
  }

  if (!/^\d{5}$/.test(otp) || !safeEqual(hashOtp(email, otp), doc.otpHash)) {
    doc.attempts += 1;
    await doc.save();
    const left = MAX_ATTEMPTS - doc.attempts;
    return res.status(400).json({ message: left > 0 ? `รหัส OTP ไม่ถูกต้อง (เหลืออีก ${left} ครั้ง)` : 'กรอกรหัสผิดหลายครั้งเกินไป กรุณาขอรหัส OTP ใหม่' });
  }

  // ถูกต้อง: OTP ใช้ได้ครั้งเดียว → ออกโทเคนสำหรับตั้งรหัสผ่านใหม่ (อายุ 10 นาที)
  const nonce = crypto.randomBytes(16).toString('hex');
  doc.otpHash = '';
  doc.resetNonce = nonce;
  doc.expiresAt = new Date(Date.now() + OTP_TTL_MS);
  await doc.save();

  const resetToken = jwt.sign({ email, nonce, purpose: 'reset' }, JWT_SECRET, { expiresIn: '10m' });
  res.json({ resetToken });
});

router.post('/reset-password', async (req, res) => {
  const { resetToken, password } = req.body || {};
  if (typeof password !== 'string' || password.length < 6 || password.length > 72) {
    return res.status(400).json({ message: 'รหัสผ่านต้องมีความยาว 6-72 ตัวอักษร' });
  }

  let payload;
  try {
    payload = jwt.verify(String(resetToken || ''), JWT_SECRET);
  } catch {
    return res.status(400).json({ message: 'ลิงก์ตั้งรหัสผ่านหมดอายุ กรุณาเริ่มขั้นตอนใหม่' });
  }
  if (payload.purpose !== 'reset' || !payload.nonce) {
    return res.status(400).json({ message: 'ลิงก์ตั้งรหัสผ่านไม่ถูกต้อง' });
  }

  const doc = await PasswordReset.findOne({ email: payload.email, resetNonce: payload.nonce });
  if (!doc) return res.status(400).json({ message: 'ลิงก์ตั้งรหัสผ่านหมดอายุหรือถูกใช้ไปแล้ว' });

  const user = await User.findOne({ email: payload.email });
  if (!user) return res.status(400).json({ message: 'ไม่พบบัญชีผู้ใช้' });

  // เปลี่ยนรหัสผ่าน = ทุกเซสชันเดิมเป็นโมฆะ (sessionId ว่าง → ต้องล็อกอินใหม่ด้วยรหัสผ่านใหม่)
  await User.updateOne({ _id: user._id }, { password: await bcrypt.hash(password, 10), sessionId: '' });
  await PasswordReset.deleteOne({ _id: doc._id }); // ใช้ได้ครั้งเดียว

  res.json({ message: 'ตั้งรหัสผ่านใหม่เรียบร้อย กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่' });
});

module.exports = router;
