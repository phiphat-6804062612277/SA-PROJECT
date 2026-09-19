const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');

function auth(req, res, next) {
  const header = req.header('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return res.status(401).json({ message: 'กรุณาเข้าสู่ระบบ' });

  try {
    req.user = jwt.verify(token, JWT_SECRET); // { id, email, role }
    next();
  } catch (err) {
    return res.status(401).json({ message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' });
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
