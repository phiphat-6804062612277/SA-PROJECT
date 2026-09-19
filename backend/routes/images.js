const express = require('express');
const Image = require('../models/Image');
const { isValidId } = require('../utils/helpers');

const router = express.Router();

// เสิร์ฟรูปที่อัปโหลด (สาธารณะ) — id ไม่ซ้ำและรูปไม่เปลี่ยนเนื้อหา จึงแคชได้ยาว
router.get('/:id', async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(404).json({ message: 'ไม่พบรูปภาพ' });
  const img = await Image.findById(req.params.id).select('+data mime');
  if (!img) return res.status(404).json({ message: 'ไม่พบรูปภาพ' });

  res.set({
    'Content-Type': img.mime,
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': 'cross-origin', // frontend อยู่คนละโดเมนกับ API
  });
  res.send(Buffer.from(img.data));
});

module.exports = router;
