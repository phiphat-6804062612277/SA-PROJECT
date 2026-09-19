const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

const isValidId = (v) => typeof v === 'string' && OBJECT_ID_RE.test(v);

// ผู้ใช้เก่าที่สมัครก่อนแยกบทบาทจะมี role = 'user' → ถือเป็นผู้ซื้อ
const normalizeRole = (role) => (role === 'seller' || role === 'admin' ? role : 'buyer');

// ข้อจำกัดความยาวข้อความ (ประหยัดพื้นที่ฐานข้อมูล) — frontend ใช้ค่าเดียวกันใน src/lib/limits.js
const LIMITS = {
  PRODUCT_NAME: 100,
  PRODUCT_DESC: 1000,
  STORE_NAME: 60,
  STORE_DESC: 300,
  REVIEW: 500,
  REVIEW_IMAGES: 4,
  USER_NAME: 60,
  BAN_REASON: 200,
  // ราคา/สต็อกสูงสุด — กันตัวเลขผิดปกติ (เช่น 1,000,000,000,000,...) ที่ทำให้ UI/การคำนวณพัง
  MAX_PRICE: 10000000,
  MAX_STOCK: 100000,
  // Dispute
  DISPUTE_REASON_MIN: 10,
  DISPUTE_REASON: 1000,
  DISPUTE_NOTE_MIN: 5,
  DISPUTE_NOTE: 1000,
  DISPUTE_MESSAGE: 500,
  DISPUTE_IMAGES: 5,
  TRACKING_MAX: 40,
};

// สินค้าที่ลูกค้ามองเห็น/ซื้อได้: ไม่ถูกลบ และเจ้าของ/ร้านไม่ถูกระงับ
// (ราคาเกินเพดานถือเป็นข้อมูลผิดปกติ → ซ่อนจากตลาดจนกว่าผู้ขายจะแก้ราคา)
const VISIBLE_PRODUCT = {
  isActive: { $ne: false },
  suspended: { $ne: true },
  price: { $lte: LIMITS.MAX_PRICE },
};
const isProductBuyable = (p) => !!p && p.isActive !== false && !p.suspended && p.price <= LIMITS.MAX_PRICE;

const serializeUser = (u) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  phone: u.phone || '',
  address: u.address || '',
  role: normalizeRole(u.role),
  storeName: u.storeName || '',
  storeDescription: u.storeDescription || '',
  storeLogoUrl: u.storeLogoUrl || '',
  storeBannerUrl: u.storeBannerUrl || '',
  avatarUrl: u.avatarUrl || '',
  storeBanned: !!u.storeBanned,
});

// เลขพัสดุ: ตัดช่องว่าง/ขีดคั่นกลาง ทำเป็นตัวพิมพ์ใหญ่ (กัน "th123" กับ "TH 123" ถูกมองเป็นคนละเลข)
const normalizeTracking = (v) => String(v || '').replace(/[\s-]+/g, '').toUpperCase();
// ตรวจรูปแบบ: ตัวอักษร A-Z / ตัวเลข 8-30 ตัว (รองรับ Kerry, Flash, ไปรษณีย์ไทย EB123456789TH ฯลฯ) — คืนข้อความ error หรือ ''
const trackingError = (t) => {
  if (!t) return 'กรุณาระบุเลขพัสดุ';
  if (!/^[A-Z0-9]+$/.test(t)) return 'เลขพัสดุใช้ได้เฉพาะตัวอักษรภาษาอังกฤษและตัวเลข';
  if (t.length < 8 || t.length > 30) return 'เลขพัสดุต้องมีความยาว 8-30 ตัวอักษร';
  return '';
};

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// error ที่ตั้งใจให้ส่งข้อความกลับหา client ได้
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.expose = true;
  }
}

module.exports = {
  isValidId,
  normalizeRole,
  normalizeTracking,
  trackingError,
  serializeUser,
  escapeRegex,
  HttpError,
  LIMITS,
  VISIBLE_PRODUCT,
  isProductBuyable,
};
