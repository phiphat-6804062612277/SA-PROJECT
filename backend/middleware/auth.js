const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');
const User = require('../models/User');
const { normalizeRole } = require('../utils/helpers');

const bannedBody = (user) => ({
  code: 'BANNED',
  message: `บัญชีนี้ถูกระงับการใช้งาน${user.banReason ? ` (เหตุผล: ${user.banReason})` : ''}`,
  banReason: user.banReason || '',
});

// 1 บัญชีใช้งานได้ 1 เครื่องเท่านั้น: ล็อกอินจากเครื่องใหม่ → เครื่องเดิมได้ 401 พร้อมรหัสนี้ (หน้าเว็บใช้แยกจาก "หมดอายุ" เพื่อแจ้งผู้ใช้ให้ถูกต้อง)
const SESSION_REPLACED_BODY = {
  code: 'SESSION_REPLACED',
  message: 'บัญชีนี้ถูกเข้าสู่ระบบจากอุปกรณ์หรือเบราว์เซอร์อื่น ระบบจึงออกจากระบบเครื่องนี้ให้อัตโนมัติ',
};

/*
 * ตรวจ JWT แล้วโหลดผู้ใช้จากฐานข้อมูลทุกครั้ง เพื่อ
 *  - รู้สถานะ "ถูกแบน" ทันที (แบนแล้วใช้ token เดิมไม่ได้)
 *  - ใช้ role ล่าสุดจาก DB ไม่ใช่ role ที่ฝังใน token
 *  - เช็กว่า token นี้ยังเป็นเซสชันล่าสุดของบัญชี (`sid` ต้องตรงกับ User.sessionId) — Single Active Session
 *
 * allowBanned = true (ใช้เฉพาะ /api/chat): ให้ผู้ใช้ที่ถูกแบนผ่านได้เพื่อ "ติดต่อ Admin / ยื่นอุทธรณ์" — ผ่านด้วย
 *   (1) token ล็อกอินเดิมที่ยังไม่หมดอายุ หรือ (2) appeal token ที่ /api/auth/login ออกให้หลังยืนยันรหัสผ่านถูกต้อง
 *   (appeal token ใช้ได้เฉพาะกับ route ที่เปิด allowBanned และหมดประโยชน์ทันทีที่ปลดแบน)
 * req.user.banned = true → route ต้องจำกัดสิทธิ์เองให้ใช้ได้เฉพาะแชตซัพพอร์ต
 */
function authenticate({ allowBanned = false } = {}) {
  return async (req, res, next) => {
    const header = req.header('Authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) return res.status(401).json({ message: 'กรุณาเข้าสู่ระบบ' });

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' });
    }
    // โทเคนรีเซ็ตรหัสผ่านใช้เป็นโทเคนล็อกอินไม่ได้ / appeal token ใช้ได้เฉพาะเส้นทางที่เปิด allowBanned
    const isAppeal = payload.purpose === 'appeal';
    if (payload.purpose && !(isAppeal && allowBanned)) return res.status(401).json({ message: 'โทเคนไม่ถูกต้อง' });

    try {
      const user = await User.findById(payload.id).select('+sessionId email role isBanned banReason storeBanned storeBanReason');
      if (!user) return res.status(401).json({ message: 'ไม่พบบัญชีผู้ใช้ กรุณาเข้าสู่ระบบใหม่' });
      if (isAppeal && !user.isBanned) {
        return res.status(401).json({ message: 'บัญชีของคุณถูกปลดระงับแล้ว กรุณาเข้าสู่ระบบใหม่' });
      }
      // Single Active Session: โทเคนล็อกอินต้องเป็นของเซสชันล่าสุดที่บันทึกไว้ใน DB เท่านั้น (เช็กทุกคำขอ)
      // (appeal token ออกให้ผู้ที่ถูกแบนหลังยืนยันรหัสผ่าน — ไม่ใช่เซสชันล็อกอิน จึงไม่เกี่ยวกับกติกานี้)
      if (!isAppeal && (!payload.sid || payload.sid !== user.sessionId)) {
        // sessionId ใน DB ยังมีค่า = มีการล็อกอินจากที่อื่นมาแทนที่ / ว่าง = ออกจากระบบไปแล้ว หรือโทเคนรุ่นเก่าที่ไม่มี sid
        if (user.sessionId && payload.sid) return res.status(401).json(SESSION_REPLACED_BODY);
        return res.status(401).json({ message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' });
      }
      if (user.isBanned && !allowBanned) return res.status(403).json(bannedBody(user));
      req.user = {
        id: String(user._id),
        email: user.email,
        role: normalizeRole(user.role),
        banned: !!user.isBanned,
        storeBanned: !!user.storeBanned,
        sid: isAppeal ? '' : payload.sid, // เซสชันของโทเคนนี้ (appeal token ไม่มีเซสชันล็อกอิน)
      };
      next();
    } catch (err) {
      next(err);
    }
  };
}

const auth = authenticate();
auth.allowBanned = authenticate({ allowBanned: true });
auth.bannedBody = bannedBody;

// ใช้ต่อจาก auth เช่น router.post('/', auth, requireRole('seller'), handler)
auth.requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ message: 'บัญชีของคุณไม่มีสิทธิ์ทำรายการนี้' });
  }
  next();
};

module.exports = auth;
