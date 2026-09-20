import { useEffect, useState } from 'react';
import API from '@/lib/api';
import { compressImage } from '@/lib/image';

// ---------------------------------------------------------------------------
// ระบบไฟล์แนบในแชต (ไม่ใช้แพ็กเกจเพิ่ม)
//  - รูป JPG/PNG/WebP: ย่อบนเบราว์เซอร์ด้วย <canvas> เหมือนรูปโปรไฟล์ (ดู lib/image.js)
//  - เอกสาร PDF/TXT/CSV/DOC(X)/XLS(X)/PPT(X): ส่งตามจริง ไม่เกิน 1 MB
//  ส่งเป็น data URL ใน JSON ไปที่ POST /api/chat/attachments → ได้ url (/api/chat/files/<id>) ไปแนบกับข้อความ
//  ไฟล์แนบ "ไม่สาธารณะ" ต้องแนบ Authorization ทุกครั้ง จึงดึงเป็น Blob ผ่าน axios แล้วแสดง/ดาวน์โหลดจาก Object URL
// ---------------------------------------------------------------------------

export const ATTACH_MAX_FILE_BYTES = 1024 * 1024; // ต้องตรงกับ MAX_FILE_BYTES ใน backend/utils/attachments.js
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const DOC_EXTS = ['pdf', 'txt', 'csv', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
export const ATTACH_ACCEPT = `.jpg,.jpeg,.png,.webp,${IMAGE_TYPES.join(',')},${DOC_EXTS.map((e) => `.${e}`).join(',')}`;
export const ATTACH_HINT = 'รูปภาพ (JPG, PNG, WebP) หรือเอกสาร (PDF, TXT, CSV, DOC/DOCX, XLS/XLSX, PPT/PPTX ไม่เกิน 1 MB)';

// เอกสารที่เปิดดูในแท็บใหม่ได้เลย (ที่เหลือให้ดาวน์โหลด)
export const VIEWABLE_MIMES = ['application/pdf', 'text/plain', 'text/csv'];

// คำขอไปที่ API ด้วยโทเคนที่ระบุ (เช่น appeal token ในหน้า /suspended) — ไม่ระบุ = ใช้โทเคนใน localStorage ตามปกติ
export const authOpts = (token) => (token ? { authToken: token, skipAuthRedirect: true } : {});

export const extOf = (name = '') => {
  const m = /\.([A-Za-z0-9]{1,5})$/.exec(String(name));
  return m ? m[1].toLowerCase() : '';
};

export const formatBytes = (n = 0) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'));
    reader.readAsDataURL(file);
  });
}

// ตรวจไฟล์ก่อนอัปโหลดแบบเร็ว (ฝั่ง backend ตรวจซ้ำอีกชั้น) — คืนข้อความ error หรือ ''
export function validateAttachment(file) {
  if (!file) return 'ไม่พบไฟล์';
  if (IMAGE_TYPES.includes(file.type)) return '';
  if (!DOC_EXTS.includes(extOf(file.name))) return `รองรับเฉพาะ${ATTACH_HINT}`;
  if (file.size > ATTACH_MAX_FILE_BYTES) return 'ไฟล์เอกสารใหญ่เกินไป (ไม่เกิน 1 MB)';
  if (file.size === 0) return 'ไฟล์ว่างเปล่า';
  return '';
}

/**
 * อัปโหลดไฟล์แนบ → { id, url, name, mime, size, kind: 'image' | 'file' }
 *   scope = 'conversation' (แชตซื้อขาย/ซัพพอร์ต) | 'dispute' (แชตข้อพิพาท), scopeId = id ของห้อง/ข้อพิพาท
 */
export async function uploadChatAttachment(file, { scope, scopeId, token } = {}) {
  const problem = validateAttachment(file);
  if (problem) throw new Error(problem);

  let fileName = file.name || 'file';
  let dataUrl;
  if (IMAGE_TYPES.includes(file.type)) {
    dataUrl = await compressImage(file, 'chat'); // ย่อ + แปลงเป็น JPEG
    fileName = `${fileName.replace(/\.[^.]+$/, '') || 'image'}.jpg`;
  } else {
    dataUrl = await readAsDataUrl(file);
  }
  const res = await API.post('/chat/attachments', { scope, scopeId, fileName, dataUrl }, authOpts(token));
  return res.data;
}

// ---------- ดึงไฟล์ (Blob) พร้อมแคช ----------
const blobCache = new Map(); // `${token}|${url}` → Promise<objectUrl>
const apiPath = (url) => String(url).replace(/^\/api(?=\/)/, ''); // baseURL ของ axios ลงท้าย /api อยู่แล้ว

export function fetchFileBlobUrl(url, token) {
  const key = `${token || ''}|${url}`;
  if (!blobCache.has(key)) {
    const p = API.get(apiPath(url), { responseType: 'blob', ...authOpts(token) })
      .then((res) => URL.createObjectURL(res.data))
      .catch((err) => {
        blobCache.delete(key); // ลองใหม่ได้ภายหลัง
        throw err;
      });
    blobCache.set(key, p);
  }
  return blobCache.get(key);
}

// ดาวน์โหลดไฟล์ลงเครื่อง (ตั้งชื่อไฟล์เดิม)
export async function downloadFile(url, name, token) {
  const href = await fetchFileBlobUrl(url, token);
  const a = document.createElement('a');
  a.href = href;
  a.download = name || 'file';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// เปิดไฟล์ในแท็บใหม่ (เปิดหน้าต่างก่อนแล้วค่อยโหลด เพื่อไม่ให้ Popup blocker ตัดทิ้ง)
export async function openFile(url, name, token) {
  const win = window.open('', '_blank');
  try {
    const href = await fetchFileBlobUrl(url, token);
    if (win) {
      win.location.href = href;
    } else {
      await downloadFile(url, name, token); // เปิดแท็บใหม่ไม่ได้ → ดาวน์โหลดแทน
    }
  } catch (err) {
    if (win) win.close();
    throw err;
  }
}

// Hook: โหลดรูปแนบเป็น Object URL สำหรับ <img> → { src, error }
export function useBlobUrl(url, token) {
  const key = `${token || ''}|${url || ''}`;
  const [state, setState] = useState({ key: '', src: '', error: false });

  useEffect(() => {
    if (!url) return undefined;
    let alive = true;
    fetchFileBlobUrl(url, token)
      .then((src) => alive && setState({ key, src, error: false }))
      .catch(() => alive && setState({ key, src: '', error: true }));
    return () => {
      alive = false;
    };
  }, [url, token, key]);

  return state.key === key ? { src: state.src, error: state.error } : { src: '', error: false };
}

// เวลาในแชต: "14:05"
export const timeText = (d) => new Date(d).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

// หัวข้อคั่นวัน: วันนี้ / เมื่อวาน / 12 ก.ย. 2569
export function dayLabel(d) {
  const date = new Date(d);
  const start = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(new Date()) - start(date)) / 86400000);
  if (diff === 0) return 'วันนี้';
  if (diff === 1) return 'เมื่อวาน';
  return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

// เวลาแบบสั้นในรายการห้อง: วันนี้ = เวลา, อื่นๆ = วันที่
export function listTime(d) {
  if (!d) return '';
  const date = new Date(d);
  return date.toDateString() === new Date().toDateString()
    ? timeText(date)
    : date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}
