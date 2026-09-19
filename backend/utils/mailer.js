const { RESEND_API_KEY, MAIL_FROM } = require('../config');

/*
 * ส่งรหัส OTP ทางอีเมล
 *  - ตั้ง RESEND_API_KEY + MAIL_FROM แล้ว → ส่งอีเมลจริงผ่าน Resend (ใช้ fetch ในตัว Node ไม่ต้องติดตั้งแพ็กเกจเพิ่ม)
 *  - ไม่ตั้ง → แสดงรหัสใน console ของ backend (ใช้คู่กับ OTP_DEMO_MODE ตอนพัฒนา/สาธิต)
 */
async function sendOtpEmail(to, otp) {
  if (RESEND_API_KEY && MAIL_FROM) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: MAIL_FROM,
        to: [to],
        subject: 'รหัส OTP สำหรับตั้งรหัสผ่านใหม่ — Solify',
        text: `รหัส OTP ของคุณคือ ${otp}\nรหัสนี้ใช้ได้ 10 นาที หากคุณไม่ได้เป็นผู้ขอ โปรดละเว้นอีเมลนี้`,
      }),
    });
    if (!res.ok) throw new Error(`ส่งอีเมลไม่สำเร็จ (${res.status})`);
    return 'email';
  }
  console.log(`[OTP] ${to} → ${otp}`);
  return 'console';
}

module.exports = { sendOtpEmail };
