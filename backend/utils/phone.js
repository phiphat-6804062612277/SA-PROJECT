/*
 * ตรวจและจัดรูปแบบเบอร์โทรศัพท์ไทย (ช่องนี้ไม่บังคับ — เว้นว่างได้)
 *  - รับรูปแบบที่คนพิมพ์กันทั่วไป: 081-234-5678, 081 234 5678, (081) 234.5678
 *  - รับรหัสประเทศ: +66 81 234 5678, 66812345678, 0066812345678, +66(0)81...
 *  - มือถือ: 10 หลัก ขึ้นต้น 06 / 08 / 09     บ้าน/สำนักงาน: 9 หลัก ขึ้นต้น 02 / 03 / 04 / 05 / 07
 * คืน { ok, value }  โดย value = เบอร์รูปแบบมาตรฐานติดกัน เช่น 0812345678
 */
const MOBILE = /^0[689]\d{8}$/;
const LANDLINE = /^0[2-57]\d{7}$/;

function validatePhone(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return { ok: true, value: '' };

  let d = raw.replace(/[\s\-.()]/g, '');
  if (!/^\+?\d+$/.test(d)) return { ok: false, message: INVALID };
  d = d.replace(/^\+/, '');

  if (d.startsWith('0066')) d = `0${d.slice(4)}`;
  else if (d.startsWith('660')) d = `0${d.slice(3)}`; // +66(0)81... เขียนศูนย์ซ้ำ
  else if (d.startsWith('66') && (d.length === 11 || d.length === 10)) d = `0${d.slice(2)}`;

  if (MOBILE.test(d) || LANDLINE.test(d)) return { ok: true, value: d };
  return { ok: false, message: INVALID };
}

const INVALID = 'เบอร์โทรศัพท์ไม่ถูกต้อง (ตัวอย่าง 0812345678 หรือ +66 81 234 5678)';

module.exports = { validatePhone };
