const express = require('express');
const Image = require('../models/Image');
const auth = require('../middleware/auth');
const { IMAGE_LIMITS, KIND_ROLES, MAX_UPLOADS_PER_DAY, ORPHAN_AGE_MS, imageUrl, decodeDataUrl } = require('../utils/images');

const router = express.Router();

// อัปโหลดรูป: body { kind: 'avatar'|'logo'|'banner'|'review', dataUrl: 'data:image/jpeg;base64,...' }
// (frontend ย่อ/บีบรูปก่อนส่ง จึงไม่ต้องใช้ multer หรือแพ็กเกจเพิ่ม) → { id, url }
router.post('/', auth, async (req, res) => {
  const kind = String(req.body?.kind || '');
  if (!Object.hasOwn(KIND_ROLES, kind)) return res.status(400).json({ message: 'ชนิดรูปภาพไม่ถูกต้อง' });
  if (!KIND_ROLES[kind].includes(req.user.role)) {
    return res.status(403).json({ message: 'บัญชีของคุณไม่มีสิทธิ์อัปโหลดรูปประเภทนี้' });
  }

  const decoded = decodeDataUrl(req.body?.dataUrl);
  if (decoded.error) return res.status(400).json({ message: decoded.error });

  const limit = IMAGE_LIMITS[kind];
  if (decoded.buffer.length > limit) {
    return res.status(400).json({ message: `รูปภาพใหญ่เกินไป (ไม่เกิน ${Math.round(limit / 1024)} KB หลังย่อ)` });
  }
  const since = new Date(Date.now() - ORPHAN_AGE_MS);
  if ((await Image.countDocuments({ ownerId: req.user.id, createdAt: { $gt: since } })) >= MAX_UPLOADS_PER_DAY) {
    return res.status(429).json({ message: `อัปโหลดรูปได้ไม่เกิน ${MAX_UPLOADS_PER_DAY} รูปต่อวัน กรุณาลองใหม่ภายหลัง` });
  }

  const img = await Image.create({
    ownerId: req.user.id,
    kind,
    mime: decoded.mime,
    size: decoded.buffer.length,
    data: decoded.buffer,
  });
  res.status(201).json({ id: img._id, url: imageUrl(img._id), size: img.size });
});

module.exports = router;
