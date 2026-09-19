const Order = require('../models/Order');
const { releaseToSeller, reconcilePayouts, autoReleaseTime } = require('../utils/escrow');
const { AUTO_RELEASE_DAYS, AUTO_RELEASE_INTERVAL_MINUTES, AUTO_RELEASE_ENABLED } = require('../config');

/*
 * Worker ปล่อยเงิน Escrow อัตโนมัติ (ไม่ใช้แพ็กเกจเพิ่ม — ใช้ setInterval)
 * ทุกรอบ (ค่าเริ่มต้น 1 ชั่วโมง) จะหาออเดอร์ที่
 *   1) status === 'SHIPPED'
 *   2) autoReleaseAt <= ตอนนี้ (ครบกำหนด)
 *   3) ไม่ใช่ DISPUTED (ออเดอร์ที่ถูกเปิดข้อพิพาทมี status เป็น DISPUTED และ autoReleaseAt = null จึงไม่ถูกเลือก)
 * แล้วโอนเงินเข้า Wallet ผู้ขาย → COMPLETED + บันทึก Transaction (AUTO_RELEASE)
 *
 * การปล่อยเงินแต่ละออเดอร์เป็น atomic (เงื่อนไข status = SHIPPED ตรวจอีกครั้งตอนอัปเดต)
 * ถ้าผู้ซื้อกดยืนยัน/เปิดข้อพิพาทพร้อมกันกับ Worker จะมีเพียงฝ่ายเดียวที่สำเร็จ
 */

// ออเดอร์ที่จัดส่งไว้ก่อนมีฟีเจอร์นี้ (ยังไม่มี autoReleaseAt) → คำนวณให้จาก shippedAt (ไม่มี shippedAt = นับจากตอนนี้)
async function backfillAutoReleaseAt(now = new Date()) {
  const legacy = await Order.find({ status: 'SHIPPED', autoReleaseAt: null }).select('shippedAt').limit(1000);
  for (const o of legacy) {
    await Order.updateOne(
      { _id: o._id, status: 'SHIPPED', autoReleaseAt: null },
      { autoReleaseAt: autoReleaseTime(o.shippedAt || now) }
    );
  }
}

async function runAutoRelease({ now = new Date(), batch = 500 } = {}) {
  await backfillAutoReleaseAt(now);

  const due = await Order.find({
    status: 'SHIPPED',
    escrowStatus: 'HELD',
    autoReleaseAt: { $lte: now },
  })
    .select('_id')
    .sort({ autoReleaseAt: 1 })
    .limit(batch);

  let released = 0;
  let failed = 0;
  for (const { _id } of due) {
    try {
      const order = await releaseToSeller(
        { _id, status: 'SHIPPED', autoReleaseAt: { $lte: now } },
        { by: 'auto' }
      );
      if (order) released += 1;
    } catch (err) {
      failed += 1;
      console.error(`[auto-release] ปล่อยเงินออเดอร์ ${_id} ไม่สำเร็จ:`, err.message);
    }
  }
  return { checked: due.length, released, failed };
}

let timer = null;
let running = false;

async function tick() {
  if (running) return; // กันรอบซ้อน
  running = true;
  try {
    const r = await runAutoRelease();
    if (r.checked) console.log(`[auto-release] ตรวจ ${r.checked} ออเดอร์ ปล่อยเงินแล้ว ${r.released} ล้มเหลว ${r.failed}`);
    const fix = await reconcilePayouts();
    if (fix.fixed) console.log(`[reconcile] กู้คืนรายการเงินที่ค้างอยู่ ${fix.fixed} รายการ`);
  } catch (err) {
    console.error('[auto-release] error:', err.message);
  } finally {
    running = false;
  }
}

function startAutoRelease() {
  if (!AUTO_RELEASE_ENABLED) {
    console.log('⏸️  Auto-release worker ถูกปิดไว้ (AUTO_RELEASE_ENABLED=false)');
    return null;
  }
  if (timer) return timer;
  const everyMs = Math.max(1000, AUTO_RELEASE_INTERVAL_MINUTES * 60 * 1000);
  // รันทันทีตอนเปิดเซิร์ฟเวอร์ (เผื่อเซิร์ฟเวอร์หลับ/ดับตอนครบกำหนด เช่น Render แพ็กเกจฟรี) แล้วรันซ้ำทุกช่วง
  setTimeout(tick, 3000).unref();
  timer = setInterval(tick, everyMs);
  timer.unref();
  console.log(`⏱️  Auto-release worker เริ่มทำงาน: ปล่อยเงินหลังจัดส่ง ${AUTO_RELEASE_DAYS} วัน, ตรวจทุก ${AUTO_RELEASE_INTERVAL_MINUTES} นาที`);
  return timer;
}

function stopAutoRelease() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { runAutoRelease, startAutoRelease, stopAutoRelease };
