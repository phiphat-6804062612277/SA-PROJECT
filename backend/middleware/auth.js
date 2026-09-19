const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');
const User = require('../models/User');
const { normalizeRole } = require('../utils/helpers');

/*
 * ตรวจ JWT แล้วโหลดผู้ใช้จากฐานข้อมูลทุกครั้ง เพื่อ
 *  - รู้สถานะ "ถูกแบน" ทันที (แบนแล้วใช้ token เดิมไม่ได้)
 *  - ใช้ role ล่าสุดจาก DB ไม่ใช่ role ที่ฝังใน token
 */
async function auth(req, res, next) {
  const header = req.header('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return res.status(401).json({ message: 'กรุณาเข้าสู่ระบบ' });

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' });
  }
  if (payload.purpose) return res.status(401).json({ message: 'โทเคนไม่ถูกต้อง' }); // โทเคนรีเซ็ตรหัสผ่านใช้เป็นโทเคนล็อกอินไม่ได้

  try {
    const user = await User.findById(payload.id).select('email role isBanned banReason');
    if (!user) return res.status(401).json({ message: 'ไม่พบบัญชีผู้ใช้ กรุณาเข้าสู่ระบบใหม่' });
    if (user.isBanned) {
      return res.status(403).json({
        code: 'BANNED',
        message: `บัญชีนี้ถูกระงับการใช้งาน${user.banReason ? ` (เหตุผล: ${user.banReason})` : ''}`,
      });
    }
    req.user = { id: String(user._id), email: user.email, role: normalizeRole(user.role) };
    next();
  } catch (err) {
    next(err);
  }
}

// ใช้ต่อจาก auth เช่น router.post('/', auth, requireRole('seller'), handler)
auth.requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ message: 'บัญชีของคุณไม่มีสิทธิ์ทำรายการนี้' });
  }
  next();
};

module.exports = auth;
