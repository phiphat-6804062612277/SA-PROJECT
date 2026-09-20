const Image = require('../models/Image');

// path ของรูปที่เสิร์ฟจาก API ของเราเอง เช่น /api/images/665f...
const IMAGE_URL_RE = /^\/api\/images\/([a-f\d]{24})$/i;
const imageUrl = (id) => `/api/images/${id}`;

// ขนาดสูงสุดต่อรูป (ไบต์ หลังถอดรหัส) — frontend ย่อรูปก่อนอัปโหลดให้ไม่เกินนี้
const IMAGE_LIMITS = { avatar: 200 * 1024, logo: 200 * 1024, banner: 600 * 1024, review: 500 * 1024 };
// ใครอัปโหลดรูปชนิดไหนได้
const KIND_ROLES = {
  avatar: ['buyer', 'seller', 'admin'],
  logo: ['seller'],
  banner: ['seller'],
  review: ['buyer'],
};
// จำกัดจำนวนรูปที่อัปโหลดต่อบัญชีใน 24 ชั่วโมง — รูปที่ไม่ได้ถูกใช้งานจะถูกลบโดย jobs/imageCleanup.js หลังพ้น 24 ชม. จึงไม่สะสมถาวร
const MAX_UPLOADS_PER_DAY = 40;
const ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;

// ดูชนิดไฟล์จาก "magic bytes" จริงๆ (ไม่เชื่อ header ที่ client ส่งมา) — รองรับ JPEG / PNG / WebP เท่านั้น (ไม่รับ SVG/GIF)
function sniffMime(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

// แปลง data URL (data:image/jpeg;base64,....) → { buffer, mime } หรือ { error }
function decodeDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') return { error: 'ไม่พบข้อมูลรูปภาพ' };
  const head = /^data:image\/(?:jpeg|png|webp);base64,/.exec(dataUrl);
  if (!head) return { error: 'รองรับเฉพาะไฟล์ภาพ JPEG, PNG หรือ WebP' };
  const b64 = dataUrl.slice(head[0].length);
  if (!b64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return { error: 'ข้อมูลรูปภาพไม่ถูกต้อง' };
  const buffer = Buffer.from(b64, 'base64');
  const mime = sniffMime(buffer);
  if (!mime) return { error: 'ไฟล์นี้ไม่ใช่รูปภาพที่รองรับ (JPEG, PNG, WebP)' };
  return { buffer, mime };
}

// หารูปที่ผู้ใช้เป็นเจ้าของและเป็นชนิดที่ต้องการ (ตรวจจาก URL ที่ client ส่งมา) — ไม่เจอ = null
async function findOwnedImage(url, ownerId, kinds) {
  const m = IMAGE_URL_RE.exec(String(url || ''));
  if (!m) return null;
  return Image.findOne({ _id: m[1], ownerId, kind: { $in: kinds } }).select('_id kind');
}

// ตรวจค่าฟิลด์รูปของโปรไฟล์/ร้าน: '' = ลบรูป, ค่าเดิม = ไม่เปลี่ยน, อื่นๆ ต้องเป็นรูปที่เจ้าของอัปโหลดชนิดนั้นจริง
async function checkImageField(value, ownerId, kind, current = '') {
  const v = String(value ?? '').trim();
  if (!v) return { ok: true, value: '' };
  if (v === current) return { ok: true, value: v };
  const img = await findOwnedImage(v, ownerId, [kind]);
  if (!img) return { ok: false, message: 'รูปภาพไม่ถูกต้อง กรุณาอัปโหลดรูปใหม่อีกครั้ง' };
  return { ok: true, value: v };
}

// ลบรูปเก่าที่ถูกแทนที่แล้ว (เฉพาะรูปของเจ้าของเอง — ห้ามเรียกกับรูปรีวิว)
async function discardImage(url, ownerId) {
  const m = IMAGE_URL_RE.exec(String(url || ''));
  if (m) await Image.deleteOne({ _id: m[1], ownerId });
}

module.exports = {
  IMAGE_URL_RE,
  IMAGE_LIMITS,
  KIND_ROLES,
  MAX_UPLOADS_PER_DAY,
  ORPHAN_AGE_MS,
  imageUrl,
  sniffMime,
  decodeDataUrl,
  findOwnedImage,
  checkImageField,
  discardImage,
};
