const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

const isValidId = (v) => typeof v === 'string' && OBJECT_ID_RE.test(v);

// ผู้ใช้เก่าที่สมัครก่อนแยกบทบาทจะมี role = 'user' → ถือเป็นผู้ซื้อ
const normalizeRole = (role) => (role === 'seller' || role === 'admin' ? role : 'buyer');

const serializeUser = (u) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  phone: u.phone || '',
  address: u.address || '',
  role: normalizeRole(u.role),
});

// error ที่ตั้งใจให้ส่งข้อความกลับหา client ได้
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.expose = true;
  }
}

module.exports = { isValidId, normalizeRole, serializeUser, HttpError };
