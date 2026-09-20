const Image = require('../models/Image');
const User = require('../models/User');
const Review = require('../models/Review');
const Attachment = require('../models/Attachment');
const { IMAGE_URL_RE, ORPHAN_AGE_MS } = require('../utils/images');

/*
 * Worker เก็บกวาดรูปที่อัปโหลดแล้วไม่ได้ถูกใช้งาน (เช่น เลือกรูปโลโก้แล้วกดยกเลิก / แนบรูปรีวิวแล้วไม่ส่ง)
 * รูปที่อายุเกิน 24 ชั่วโมงและไม่มีที่ใดอ้างถึงจะถูกลบ — ที่อ้างถึงรูปได้คือ
 *   User.avatarUrl · User.storeLogoUrl · User.storeBannerUrl · Review.images
 * และไฟล์แนบแชตที่อัปโหลดแล้วไม่ได้ส่ง (Attachment.attached = false) อายุเกิน 24 ชั่วโมง
 * (ใช้ setInterval เหมือน Auto-release Worker ไม่ต้องติดตั้งแพ็กเกจเพิ่ม)
 */

// รวบรวม id ของรูปที่ยังถูกใช้งานอยู่ทั้งหมด (distinct ของแต่ละฟิลด์ → Set ของ id)
async function referencedIds() {
  const [avatars, logos, banners, reviewImages] = await Promise.all([
    User.distinct('avatarUrl'),
    User.distinct('storeLogoUrl'),
    User.distinct('storeBannerUrl'),
    Review.distinct('images'),
  ]);
  const ids = new Set();
  for (const url of [...avatars, ...logos, ...banners, ...reviewImages]) {
    const m = IMAGE_URL_RE.exec(String(url || ''));
    if (m) ids.add(m[1].toLowerCase());
  }
  return ids;
}

async function runImageCleanup({ now = new Date(), pageSize = 200, maxScan = 5000 } = {}) {
  const cutoff = new Date(now.getTime() - ORPHAN_AGE_MS);
  const used = await referencedIds();

  let scanned = 0;
  let removed = 0;
  let lastId = null;
  // ไล่ดูรูปเก่าทีละหน้าตาม _id (ไม่ดึงไฟล์จริง — select เฉพาะ _id) จนครบหรือถึงเพดานต่อรอบ
  while (scanned < maxScan) {
    const page = await Image.find({ createdAt: { $lt: cutoff }, ...(lastId ? { _id: { $gt: lastId } } : {}) })
      .sort({ _id: 1 })
      .limit(pageSize)
      .select('_id');
    if (!page.length) break;
    const orphans = page.filter((img) => !used.has(String(img._id).toLowerCase())).map((img) => img._id);
    if (orphans.length) {
      const r = await Image.deleteMany({ _id: { $in: orphans } });
      removed += r.deletedCount || 0;
    }
    scanned += page.length;
    lastId = page[page.length - 1]._id;
  }
  // ไฟล์แนบแชตที่อัปโหลดค้างไว้แต่ไม่เคยถูกส่ง (ไฟล์ที่ส่งแล้วเก็บไว้ตลอดตามประวัติแชต)
  const stale = await Attachment.deleteMany({ attached: false, createdAt: { $lt: cutoff } });
  const attachmentsRemoved = stale.deletedCount || 0;
  return { scanned, removed, attachmentsRemoved };
}

const EVERY_MS = 6 * 60 * 60 * 1000;
let timer = null;
let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    const r = await runImageCleanup();
    if (r.removed || r.attachmentsRemoved) {
      console.log(`[image-cleanup] ลบรูปที่ไม่ได้ใช้งาน ${r.removed} รูป, ไฟล์แนบแชตที่ไม่ได้ส่ง ${r.attachmentsRemoved} ไฟล์ (ตรวจ ${r.scanned})`);
    }
  } catch (err) {
    console.error('[image-cleanup] error:', err.message);
  } finally {
    running = false;
  }
}

function startImageCleanup() {
  if (timer) return timer;
  setTimeout(tick, 10_000).unref();
  timer = setInterval(tick, EVERY_MS);
  timer.unref();
  return timer;
}

function stopImageCleanup() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { runImageCleanup, startImageCleanup, stopImageCleanup };
