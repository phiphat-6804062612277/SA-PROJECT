const mongoose = require('mongoose');

// เก็บ OTP สำหรับลืมรหัสผ่าน (เก็บเป็น hash ไม่เก็บรหัสจริง) — Mongo ลบเอกสารให้เองเมื่อถึง expiresAt
const PasswordResetSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  otpHash: { type: String, default: '' },
  attempts: { type: Number, default: 0 },
  lastSentAt: { type: Date, default: Date.now },
  resetNonce: { type: String, default: '' }, // มีค่าเมื่อยืนยัน OTP แล้ว ใช้ผูกกับโทเคนรีเซ็ตรหัสผ่าน (ใช้ได้ครั้งเดียว)
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
});

module.exports = mongoose.model('PasswordReset', PasswordResetSchema);
