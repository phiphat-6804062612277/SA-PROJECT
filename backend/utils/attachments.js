const Attachment = require('../models/Attachment');
const { sniffMime } = require('./images');

/*
 * ไฟล์แนบในแชต (ใช้ร่วมกันระหว่างแชตซื้อขาย / แชตติดต่อ Admin / แชตข้อพิพาท)
 *  - รูปภาพ: JPEG / PNG / WebP (ตรวจ magic bytes จริง — ไม่รับ SVG/GIF เพราะเสี่ยงสคริปต์)
 *  - เอกสาร: PDF, TXT, CSV, DOC/DOCX, XLS/XLSX, PPT/PPTX (ตรวจนามสกุล + ลายเซ็นไฟล์ให้ตรงกัน)
 * เก็บใน MongoDB แบบ Buffer (ไม่ต้องใช้ multer/บริการภายนอก) ส่งจาก client เป็น data URL ใน JSON — body limit 2MB ของเส้นทางอัปโหลด
 */

const FILE_URL_RE = /^\/api\/chat\/files\/([a-f\d]{24})$/i;
const fileUrl = (id) => `/api/chat/files/${id}`;

const MAX_IMAGE_BYTES = 800 * 1024; // frontend ย่อรูปให้ ≤ ~700KB ก่อนส่ง
const MAX_FILE_BYTES = 1024 * 1024; // เอกสาร 1MB (base64 ≈ 1.4MB ยังอยู่ใต้ body limit 2MB)
const MAX_ATTACHMENTS_PER_DAY = 60;
const ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;

const PDF_SIG = Buffer.from('%PDF-', 'ascii');
const ZIP_SIG = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // docx / xlsx / pptx (Office Open XML = ZIP)
const OLE_SIG = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]); // doc / xls / ppt (แบบเก่า)

const startsWith = (buf, sig) => buf.length >= sig.length && buf.subarray(0, sig.length).equals(sig);
const isZip = (b) => startsWith(b, ZIP_SIG);
const isOle = (b) => startsWith(b, OLE_SIG);
// ไฟล์ข้อความ: ห้ามมี NUL และห้ามมีอักขระควบคุมแปลกๆ มากผิดปกติ (ไม่บังคับ UTF-8 เพราะไฟล์ CSV ภาษาไทยจาก Excel มักเป็น Windows-874)
function isPlainText(buf) {
  const sample = buf.subarray(0, 8192);
  let odd = 0;
  for (const c of sample) {
    if (c === 0) return false;
    if (c < 9 || (c > 13 && c < 32)) odd += 1;
  }
  return odd <= sample.length * 0.02;
}

const OFFICE = {
  doc: ['application/msword', isOle],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', isZip],
  xls: ['application/vnd.ms-excel', isOle],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', isZip],
  ppt: ['application/vnd.ms-powerpoint', isOle],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation', isZip],
};
const FILE_TYPES = {
  pdf: { mime: 'application/pdf', ok: (b) => startsWith(b, PDF_SIG) },
  txt: { mime: 'text/plain', ok: isPlainText },
  csv: { mime: 'text/csv', ok: isPlainText },
  ...Object.fromEntries(Object.entries(OFFICE).map(([ext, [mime, ok]]) => [ext, { mime, ok }])),
};
const ALLOWED_TEXT = 'รูปภาพ (JPG, PNG, WebP) หรือเอกสาร (PDF, TXT, CSV, DOC/DOCX, XLS/XLSX, PPT/PPTX)';

const extOf = (name) => {
  const m = /\.([A-Za-z0-9]{1,5})$/.exec(String(name || ''));
  return m ? m[1].toLowerCase() : '';
};

// ชื่อไฟล์ที่แสดง/ดาวน์โหลด: ตัดพาธ, อักขระควบคุม และอักขระต้องห้ามของชื่อไฟล์, ยาวไม่เกิน 100 ตัวอักษร (คงนามสกุลไว้)
function cleanFileName(name, fallback = 'file') {
  const base = String(name || '').split(/[\\/]/).pop();
  // eslint-disable-next-line no-control-regex
  let out = base.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '').replace(/\s+/g, ' ').trim();
  if (out.length > 100) {
    const ext = extOf(out);
    const tail = ext ? `.${ext}` : '';
    out = out.slice(0, 100 - tail.length) + tail;
  }
  return out || fallback;
}

// แปลง data URL (data:<mime>;base64,....) + ชื่อไฟล์ → { kind, mime, name, buffer } หรือ { error }
function decodeAttachment(dataUrl, fileName) {
  if (typeof dataUrl !== 'string') return { error: 'ไม่พบข้อมูลไฟล์' };
  const head = /^data:[^,;]*(?:;[^,;]*)*;base64,/.exec(dataUrl);
  if (!head) return { error: 'ข้อมูลไฟล์ไม่ถูกต้อง' };
  const b64 = dataUrl.slice(head[0].length);
  if (!b64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return { error: 'ข้อมูลไฟล์ไม่ถูกต้อง' };
  const buffer = Buffer.from(b64, 'base64');
  if (!buffer.length) return { error: 'ไฟล์ว่างเปล่า' };

  const imageMime = sniffMime(buffer);
  if (imageMime) {
    if (buffer.length > MAX_IMAGE_BYTES) {
      return { error: `รูปภาพใหญ่เกินไป (ไม่เกิน ${Math.round(MAX_IMAGE_BYTES / 1024)} KB หลังย่อ)` };
    }
    return { kind: 'image', mime: imageMime, name: cleanFileName(fileName, 'image'), buffer };
  }

  const ext = extOf(fileName);
  if (!ext || !Object.hasOwn(FILE_TYPES, ext)) return { error: `รองรับเฉพาะ${ALLOWED_TEXT}` };
  if (buffer.length > MAX_FILE_BYTES) {
    return { error: `ไฟล์ใหญ่เกินไป (ไม่เกิน ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB)` };
  }
  const type = FILE_TYPES[ext];
  if (!type.ok(buffer)) return { error: 'เนื้อหาไฟล์ไม่ตรงกับนามสกุลไฟล์ (ไฟล์อาจเสียหายหรือถูกเปลี่ยนนามสกุล)' };
  return { kind: 'file', mime: type.mime, name: cleanFileName(fileName), buffer };
}

async function quotaExceeded(userId) {
  const since = new Date(Date.now() - ORPHAN_AGE_MS);
  return (await Attachment.countDocuments({ ownerId: userId, createdAt: { $gt: since } })) >= MAX_ATTACHMENTS_PER_DAY;
}

// "จอง" ไฟล์แนบที่ผู้ใช้อัปโหลดไว้ให้ผูกกับข้อความ (atomic: ใช้ได้ครั้งเดียว/ต้องเป็นของผู้ส่ง/ต้องอยู่ห้องเดียวกัน) — ไม่ผ่าน = null
async function claimAttachment(url, { ownerId, scopeType, scopeId }) {
  const m = FILE_URL_RE.exec(String(url || ''));
  if (!m) return null;
  return Attachment.findOneAndUpdate(
    { _id: m[1], ownerId, scopeType, scopeId, attached: false },
    { attached: true },
    { new: true }
  ).select('-data');
}
// ส่งข้อความไม่สำเร็จ → คืนไฟล์ให้ส่งใหม่ได้
const releaseAttachment = (id) => Attachment.updateOne({ _id: id }, { attached: false });

// ฟิลด์ไฟล์ที่ฝังในข้อความ (Message / Dispute.messages)
const attachmentFields = (att) => ({
  messageType: att.kind === 'image' ? 'IMAGE' : 'FILE',
  fileUrl: fileUrl(att._id),
  fileName: att.name,
  fileMime: att.mime,
  fileSize: att.size,
});

// ส่วนหัว Content-Disposition ที่รองรับชื่อไฟล์ภาษาไทย (RFC 5987)
function contentDisposition(name, inline = false) {
  const ascii = String(name).replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const utf8 = encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}

module.exports = {
  FILE_URL_RE,
  MAX_IMAGE_BYTES,
  MAX_FILE_BYTES,
  MAX_ATTACHMENTS_PER_DAY,
  ORPHAN_AGE_MS,
  fileUrl,
  cleanFileName,
  decodeAttachment,
  quotaExceeded,
  claimAttachment,
  releaseAttachment,
  attachmentFields,
  contentDisposition,
};
