import API from '@/lib/api';

// ---------------------------------------------------------------------------
// ระบบรูปภาพ (ไม่ใช้แพ็กเกจเพิ่ม): ย่อ/บีบอัดรูปบนเบราว์เซอร์ด้วย <canvas> แล้วส่งเป็น data URL ไปที่ POST /api/uploads
// Backend ตรวจไฟล์จริง (magic bytes) + ขนาด + สิทธิ์ แล้วเสิร์ฟกลับที่ GET /api/images/:id
// ---------------------------------------------------------------------------

// ตั้งค่าตามชนิดรูป — maxBytes ต้องต่ำกว่าเพดานของ backend (utils/images.js IMAGE_LIMITS) เล็กน้อย
export const IMAGE_PRESETS = {
  avatar: { maxSide: 400, maxBytes: 180 * 1024 },
  logo: { maxSide: 400, maxBytes: 180 * 1024 },
  banner: { maxSide: 1200, maxBytes: 540 * 1024 },
  review: { maxSide: 1000, maxBytes: 450 * 1024 },
};

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_SOURCE_BYTES = 15 * 1024 * 1024; // ไฟล์ต้นฉบับใหญ่สุดที่ยอมให้เลือก (ก่อนย่อ)

// ที่อยู่ origin ของ backend (ตัด /api ท้ายออก) ใช้ประกอบ URL รูปที่เสิร์ฟจาก API
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
const API_ORIGIN = API_BASE.replace(/\/api\/?$/, '').replace(/\/$/, '');

// path รูปที่เก็บในฐานข้อมูล (/api/images/<id>) → URL เต็มสำหรับ <img src>
export function imageSrc(url) {
  if (!url) return '';
  if (url.startsWith('/api/images/')) return `${API_ORIGIN}${url}`;
  return url;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('ไม่สามารถอ่านไฟล์รูปนี้ได้'));
    };
    img.src = objectUrl;
  });
}

const dataUrlBytes = (dataUrl) => {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
};

// ย่อรูปให้ด้านยาวไม่เกิน maxSide แล้วลดคุณภาพ JPEG จนไม่เกิน maxBytes → data URL (image/jpeg)
export async function compressImage(file, kind) {
  const preset = IMAGE_PRESETS[kind];
  if (!preset) throw new Error('ชนิดรูปไม่ถูกต้อง');
  if (!file || !ACCEPTED.includes(file.type)) throw new Error('เลือกได้เฉพาะไฟล์ JPEG, PNG หรือ WebP');
  if (file.size > MAX_SOURCE_BYTES) throw new Error('ไฟล์ใหญ่เกินไป (เกิน 15 MB)');

  const img = await loadImage(file);
  let side = preset.maxSide;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const scale = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; // PNG โปร่งใส → พื้นขาว (JPEG ไม่มี alpha)
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    for (const q of [0.86, 0.75, 0.65, 0.55, 0.45]) {
      const dataUrl = canvas.toDataURL('image/jpeg', q);
      if (dataUrlBytes(dataUrl) <= preset.maxBytes) return dataUrl;
    }
    side = Math.round(side * 0.78); // ยังใหญ่เกิน → ลดขนาดภาพลงอีกแล้วลองใหม่
  }
  throw new Error('ไม่สามารถย่อรูปให้เล็กพอได้ กรุณาเลือกรูปอื่น');
}

// ย่อรูป + อัปโหลด → คืน { url, id } (url เป็น path เช่น /api/images/<id> ที่เก็บลงฟิลด์ของโปรไฟล์/ร้าน/รีวิวได้)
export async function uploadImage(file, kind) {
  const dataUrl = await compressImage(file, kind);
  const res = await API.post('/uploads', { kind, dataUrl });
  return res.data;
}
