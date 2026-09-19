require('dotenv').config({ quiet: true });

const positiveNumber = (raw, fallback) => {
  const n = Number(raw);
  return raw !== undefined && raw !== '' && Number.isFinite(n) && n > 0 ? n : fallback;
};

const isProd = process.env.NODE_ENV === 'production';

// JWT_SECRET ต้องตั้งเองบน production (dev ใช้ค่า fallback ได้เพื่อความสะดวก)
const JWT_SECRET = process.env.JWT_SECRET || (isProd ? '' : 'dev-only-secret-change-me');

module.exports = {
  isProd,
  JWT_SECRET,
  PORT: process.env.PORT || 5000,
  MONGO_URI: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/solify',
  // เว็บ frontend ที่อนุญาตให้เรียก API (คั่นด้วย , ได้หลายโดเมน)
  CLIENT_ORIGINS: (process.env.CLIENT_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean),

  // รหัสลับสำหรับสมัครบัญชี Admin ผ่านหน้าสมัครสมาชิก (ไม่ตั้ง = ปิดการสมัคร Admin)
  ADMIN_SIGNUP_CODE: process.env.ADMIN_SIGNUP_CODE || '',

  // โหมดสาธิต OTP: ตอบรหัส OTP กลับไปแสดงบนหน้าเว็บเลย (ใช้ตอนยังไม่ได้ต่อบริการส่งอีเมล)
  // ค่าเริ่มต้น: เปิดตอน dev, ปิดตอน production (ต้องตั้ง OTP_DEMO_MODE=true เองถ้าอยากใช้ตอน deploy โชว์งาน)
  OTP_DEMO_MODE: process.env.OTP_DEMO_MODE ? process.env.OTP_DEMO_MODE === 'true' : !isProd,
  // (ไม่บังคับ) ส่งอีเมล OTP จริงผ่าน Resend — https://resend.com
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  MAIL_FROM: process.env.MAIL_FROM || '',

  // Escrow: ปล่อยเงินให้ผู้ขายอัตโนมัติเมื่อครบกำหนดหลังจัดส่ง (ค่าเริ่มต้น 7 วัน — ใส่ทศนิยมได้เพื่อทดสอบ เช่น 0.001)
  AUTO_RELEASE_DAYS: positiveNumber(process.env.AUTO_RELEASE_DAYS, 7),
  // Worker ตรวจออเดอร์ครบกำหนดทุกกี่นาที (ค่าเริ่มต้น 60 = ทุก 1 ชั่วโมง) / AUTO_RELEASE_ENABLED=false เพื่อปิด
  AUTO_RELEASE_INTERVAL_MINUTES: positiveNumber(process.env.AUTO_RELEASE_INTERVAL_MINUTES, 60),
  AUTO_RELEASE_ENABLED: process.env.AUTO_RELEASE_ENABLED !== 'false',
};
