const Product = require('../models/Product');
const Conversation = require('../models/Conversation');

/*
 * งานปรับข้อมูลเก่าตอนเริ่มเซิร์ฟเวอร์ (ทำซ้ำได้ปลอดภัย — ไม่มีอะไรให้ทำก็ไม่ทำอะไร) — พลาดแล้วไม่ล้มการบูต แค่เตือน
 *  1) ถอดระบบ "ขายนอกร้านค้า": ลบฟิลด์ inStore ออกจากสินค้าเดิมทุกชิ้น → ทุกชิ้นแสดงในหน้าร้านของผู้ขายตามปกติ
 *  2) ถอดระบบปิดแชต: ลบสถานะ OPEN/CLOSED (และข้อมูลว่าใครปิด) ออกจากห้องเดิม → ห้องที่เคยถูกปิดกลับมาส่งข้อความได้
 */
async function runMigrations() {
  try {
    const p = await Product.collection.updateMany({ inStore: { $exists: true } }, { $unset: { inStore: '' } });
    const c = await Conversation.collection.updateMany(
      { $or: [{ status: { $exists: true } }, { closedAt: { $exists: true } }] },
      { $unset: { status: '', closedAt: '', closedById: '', closedBySide: '', closedByRole: '' } }
    );
    try {
      await Conversation.collection.dropIndex('type_1_status_1_lastMessageAt_-1'); // ดัชนีเดิมที่อิงสถานะห้อง
    } catch {
      /* ไม่มีดัชนีนี้ (ฐานข้อมูลใหม่/ลบไปแล้ว) */
    }
    if (p.modifiedCount || c.modifiedCount) {
      console.log(`🧹 ปรับข้อมูลเก่า: สินค้า ${p.modifiedCount} รายการ (ถอด inStore), ห้องแชต ${c.modifiedCount} ห้อง (ถอดสถานะปิดแชต)`);
    }
  } catch (err) {
    console.warn('⚠️  ปรับข้อมูลเก่าไม่สำเร็จ (ข้ามได้ ระบบยังทำงานตามปกติ):', err.message);
  }
}

module.exports = { runMigrations };
