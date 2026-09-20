# ☀️ Solify — ตลาดซื้อขาย Solar Cell ระบบ Escrow

Next.js 16 (frontend) + Express 5 / MongoDB (backend)

## ฟีเจอร์

**ผู้ซื้อ** — สมัคร/เข้าสู่ระบบ · หน้า Home แบบแบนเนอร์สินค้าเลื่อนซ้าย-ขวา + ตารางสินค้าที่ผู้ขายวางขาย · ค้นหา ·
ตะกร้า (เก็บบน server) · พิมพ์จำนวนสินค้าเองได้ · Toast แจ้งเตือน · เติมเงินเข้า Wallet · ชำระเงินผ่าน Wallet ·
ติดตามคำสั่งซื้อ/เลขพัสดุ · ยืนยันรับสินค้า · ยกเลิกก่อนจัดส่ง (คืนเงิน) · **รีวิว/ให้ดาว** ผู้ขายและสินค้าหลังรับของ

**ผู้ขาย** (เลือกบทบาทตอนสมัคร) — **ตั้งชื่อ/คำอธิบายร้านค้า** · ลง/แก้ไข/ลบสินค้า โดยเลือกได้ว่าสินค้า
"แสดงในร้าน" หรือ "ขายนอกร้าน (แสดงเฉพาะหน้าตลาด)" · Dashboard ใหม่แบบแท็บ (ภาพรวม / ออเดอร์ / สินค้า / ร้านค้า) ·
ใส่เลขพัสดุ · ปฏิเสธออเดอร์ (คืนเงินผู้ซื้อ) · **ถอนเงิน** (ผู้ขายไม่มีการ "เติมเงิน") · รีวิวผู้ซื้อ

**Admin** — ดูสถิติ · **แบน/ปลดแบนผู้ใช้** (Buyer/Seller) · **แบน/ปลดแบนร้านค้า** (สินค้าของร้านจะถูกซ่อน) · **ลบสินค้า**
ที่ไม่เหมาะสม (หน้า `/admin`) · **Dispute Resolution Panel** ไกล่เกลี่ยข้อพิพาท (หน้า `/admin/disputes`)
— **Admin ไม่มี Wallet** (เมนู/ปุ่ม Wallet ถูกแทนด้วยเมนูจัดการข้อพิพาท และ `/api/wallet` ตอบ 403 สำหรับ Admin)

**Escrow** — จ่ายเงิน → ระบบถือเงิน (`HELD`) → ผู้ขายจัดส่ง (`SHIPPED`) → ผู้ซื้อกดยืนยันรับ → โอนเงินเข้า Wallet ผู้ขาย (`RELEASED`, `COMPLETED`)
ยกเลิกได้เฉพาะก่อนจัดส่ง → คืนเงิน (`REFUNDED`) และคืนสต็อก

```
PENDING_SHIPMENT ─ผู้ขายใส่เลขพัสดุ→ SHIPPED ─┬─ ผู้ซื้อกดยืนยันรับ ───────────────┐
        │                                     ├─ ครบ 7 วัน (Auto-Release Worker) ─┼→ COMPLETED (เงินเข้าผู้ขาย)
        └→ CANCELLED (คืนเงิน)                └─ ผู้ซื้อเปิดข้อพิพาท → DISPUTED ──┤   ▲
                                                   (Freeze เงิน + ยกเลิกนับถอยหลัง) │   └ Admin: PAY_SELLER
                                                                                    ├→ REFUNDED (เงินคืนผู้ซื้อ) ← Admin: REFUND_BUYER
                                                                                    └→ SHIPPED (Admin: REJECT — นับถอยหลังใหม่)
```

**เลขพัสดุ (Tracking)** — ผู้ขายกรอกได้ครั้งเดียวและ **แก้ไขเองไม่ได้** · ระบบตัดช่องว่าง/ขีด แปลงเป็นตัวพิมพ์ใหญ่
และตรวจรูปแบบ (A-Z, 0-9 ยาว 8-30 ตัว) · **ห้ามซ้ำกับออเดอร์อื่น** (ตรวจในโค้ดและมี unique index แบบ partial บน `Order.trackingNumber`)

**Auto-Release** — ตอนใส่เลขพัสดุระบบบันทึก `shippedAt` และตั้ง `autoReleaseAt = shippedAt + 7 วัน`
Worker (`backend/jobs/autoRelease.js`, ใช้ `setInterval` ไม่ต้องลงแพ็กเกจเพิ่ม) ทำงาน **ทุก 1 ชั่วโมง** (และตอนเปิดเซิร์ฟเวอร์) ค้นหาออเดอร์ที่
`status = SHIPPED` และ `autoReleaseAt <= ตอนนี้` (ออเดอร์ `DISPUTED` ไม่ถูกเลือก) → โอนเงินเข้า Wallet ผู้ขาย → `COMPLETED`
พร้อมบันทึก Transaction ชนิด `AUTO_RELEASE` · ปรับค่าได้ด้วย `AUTO_RELEASE_DAYS`, `AUTO_RELEASE_INTERVAL_MINUTES`, `AUTO_RELEASE_ENABLED`

**Dispute (ผู้ซื้อ)** — ปุ่ม "ขอเปิดข้อพิพาท / ขอคืนเงิน" ในหน้า "สถานะคำสั่งซื้อ" (กดได้เฉพาะ `SHIPPED` และก่อนถึง `autoReleaseAt`)
ต้องกรอกเหตุผล (10-1,000 ตัวอักษร) และแนบลิงก์รูปหลักฐานได้ไม่เกิน 5 รูป → ออเดอร์เป็น `DISPUTED`, **เงินถูก Freeze** ใน Escrow,
ยกเลิกการนับถอยหลัง Auto-Release ทันที · เปิดได้ครั้งเดียวต่อออเดอร์ · ผู้ซื้อ/ผู้ขาย/Admin คุยกันในหน้า `/disputes/[id]` ได้จนกว่าจะตัดสิน

**Dispute Resolution Panel (Admin)** — `/admin/disputes`: กรองสถานะ (รอพิจารณา/ตัดสินแล้ว/ทั้งหมด) + ค้นหา (เลขออเดอร์ 24 หลักหรือ 6 หลักท้าย, ชื่อผู้ซื้อ/ผู้ขาย/ร้าน)
หน้ารายละเอียดแสดงสินค้า/ราคา เหตุผลและรูปหลักฐาน เลขพัสดุและเวลาจัดส่ง ไทม์ไลน์ และแชต แล้วตัดสินได้ 3 แบบ
(**ต้องกรอกเหตุผล `adminNote` ทุกครั้ง** และตัดสินซ้ำไม่ได้):
1. **Refund Buyer** → Order `REFUNDED`, Dispute `RESOLVED_REFUND_BUYER`, เงินจาก Escrow คืน Wallet ผู้ซื้อ
2. **Release to Seller** → Order `COMPLETED`, Dispute `RESOLVED_PAY_SELLER`, เงินจาก Escrow เข้า Wallet ผู้ขาย
3. **ปฏิเสธคำร้อง** (`REJECTED`) → Order กลับเป็น `SHIPPED` และเริ่มนับถอยหลัง Auto-Release ใหม่ (เปิดข้อพิพาทซ้ำไม่ได้)

**ระบบแจ้งเตือนงานค้าง (Notification Badge)** — จุดแดง `!` บนรูปโปรไฟล์ใน Header และบนแท็บเมนูล่าง (ผู้ซื้อ: แท็บ Profile, ผู้ขาย: แท็บ Store,
Admin: แท็บ Disputes) กดที่รูปโปรไฟล์จะเปิด Dropdown สรุปงานพร้อมปุ่มไปหน้านั้นทันที · ผู้ซื้อ = ออเดอร์ `SHIPPED` รอกด "ยืนยันรับสินค้า",
ผู้ขาย = ออเดอร์ใหม่ที่รอจัดส่ง/กรอกเลขพัสดุ + ข้อพิพาทที่ต้องชี้แจง, Admin = ข้อพิพาท `PENDING` รอตัดสิน · อัปเดตทุก 45 วินาที เมื่อเปลี่ยนหน้า และเมื่อกลับมาที่แท็บ
(`GET /api/notifications`)

**โปรไฟล์ & รูปภาพ** — ทุกบทบาท (Buyer/Seller/Admin) อัปโหลด/เปลี่ยน/ลบรูปโปรไฟล์ได้ที่ `/profile` และรูปจะแสดงใน Header, เมนู ☰, รีวิว, แชตข้อพิพาท,
รายการออเดอร์ของผู้ขาย และรายชื่อในหน้า Admin · **ผู้ขาย** ตั้งค่า "โลโก้ร้าน" และ "รูปปกร้าน (แบนเนอร์)" ได้ที่ `/seller/store` (มีตัวอย่างหน้าร้านแบบสด)
และหน้าร้าน `/store/[id]` แสดงแบนเนอร์ + โลโก้ + สถิติ (สินค้า/ขายแล้ว/คะแนน) + แท็บ "สินค้า" (เรียงล่าสุด/ขายดี/ราคา) และ "รีวิวร้านค้า"

**หน้า Home / Shopping** — เพิ่ม "ร้านค้ารีวิวดี / ยอดนิยม" (การ์ดร้านเลื่อนแนวนอน กดเข้าหน้าร้านของผู้ขายนั้นได้ทันที จัดอันดับด้วยคะแนนถ่วงน้ำหนักแบบ Bayesian
เพื่อไม่ให้ร้านที่มีรีวิวเพียงรายการเดียวชนะร้านที่ได้รีวิวดีสม่ำเสมอ — `GET /api/stores/top`) และ "สินค้ายอดนิยม" (เรียงตามจำนวนชิ้นที่ขายได้จากออเดอร์ที่ชำระเงินแล้วและไม่ถูกยกเลิก/คืนเงิน
— `GET /api/products/popular`) ทั้งสองส่วนจะซ่อนเองเมื่อยังไม่มีข้อมูล

**รีวิวแบบ Shopee** — หน้ารายละเอียดสินค้ามี 2 แท็บ "รีวิวสินค้า" / "รีวิวร้านค้า" พร้อมคะแนนเฉลี่ย สัดส่วนดาว 5→1 แกลเลอรีรูปจากผู้ซื้อจริง ตัวกรอง (ดาว / เฉพาะที่มีรูป) และแบ่งหน้า ·
รีวิวแสดงรูป+ชื่อผู้รีวิว และ **ตราความน่าเชื่อถือของผู้ซื้อ** คำนวณจากคะแนนที่ผู้ขายเคยให้ผู้ซื้อคนนั้น
(`ผู้ซื้อใหม่` ไม่มีประวัติ · `ผู้ซื้อทั่วไป` · `ผู้ซื้อคุณภาพ` เฉลี่ย ≥ 4 · `ผู้ซื้อน่าเชื่อถือ` เฉลี่ย ≥ 4.5 และมี ≥ 3 รีวิว · `ควรระมัดระวัง` เฉลี่ย < 3 และมี ≥ 3 รีวิว) ·
ผู้ซื้อแนบรูปประกอบรีวิวได้สูงสุด 4 รูป (เฉพาะรีวิวของผู้ซื้อ)

**ระบบอัปโหลดรูป (ไม่ใช้แพ็กเกจเพิ่ม)** — เบราว์เซอร์ย่อ/บีบอัดรูปด้วย `<canvas>` (avatar/logo ≤ 400px, banner ≤ 1200px, รีวิว ≤ 1000px) แล้วส่งเป็น data URL ไป `POST /api/uploads`
Backend ตรวจ **ไฟล์จริงจาก magic bytes** (รับเฉพาะ JPEG/PNG/WebP — ไม่รับ SVG/GIF), จำกัดขนาดหลังย่อ (avatar/logo 200 KB, banner 600 KB, รีวิว 500 KB),
จำกัดสิทธิ์ตามบทบาท (โลโก้/แบนเนอร์เฉพาะผู้ขาย, รูปรีวิวเฉพาะผู้ซื้อ), จำกัด 40 รูปต่อบัญชีต่อ 24 ชั่วโมง (body ขนาดใหญ่รับเฉพาะ `/api/uploads` เส้นทางอื่นจำกัด 100 KB) แล้วเก็บเป็น Buffer ใน MongoDB (collection `images`)
และเสิร์ฟที่ `GET /api/images/:id` (แคชยาว + `nosniff`) · ฟิลด์ที่อ้างถึงรูป (`avatarUrl`, `storeLogoUrl`, `storeBannerUrl`, `Review.images`) ยอมรับเฉพาะรูปที่ **เจ้าของบัญชีอัปโหลดเองและตรงชนิด**
ส่วนรูปเก่าที่ถูกแทนที่/ลบจะถูกลบออกจากฐานข้อมูลให้อัตโนมัติ (ยกเว้นรูปรีวิว) และ Worker `jobs/imageCleanup.js` (ทุก 6 ชั่วโมง) จะลบรูปที่อัปโหลดแล้วไม่ถูกใช้งานเกิน 24 ชั่วโมง (เช่น กดยกเลิกหลังเลือกรูป)

**ระบบแชต 3 ฝ่าย + ไฟล์แนบ + ช่องทางติดต่อ Admin (ไม่ใช้แพ็กเกจเพิ่ม)**
- **Buyer ↔ Store/Seller** — ปุ่ม "แชตกับร้านค้า" ที่หน้าสินค้า/หน้าร้าน (ผูกสินค้าที่สอบถามไว้บนหัวห้อง) และ "แชตกับร้าน / แชตกับผู้ซื้อ" ที่การ์ดออเดอร์ (ผูกออเดอร์) — ห้องละ 1 คู่ (`Conversation` type `DIRECT`)
- **Buyer/Seller ↔ Admin** — "ติดต่อ Admin" จากเมนูโปรไฟล์/หน้า `/chat` (`type = SUPPORT`, `topic = HELP`) ทีม Admin เห็นทุกห้องซัพพอร์ตในกล่องข้อความ `/chat` (กรอง ยังไม่อ่าน / ยื่นอุทธรณ์ / เปิดอยู่ / ปิดแล้ว, ปิด-เปิดเรื่อง, ปลดแบนบัญชี/ร้านจากในห้อง) และเริ่มคุยกับผู้ใช้จากหน้า `/admin` ได้
- **ระบบอุทธรณ์ผู้ใช้ที่ถูกแบน** — บัญชีที่ถูกแบนล็อกอินตามปกติไม่ได้ แต่ Login ด้วยรหัสผ่านที่ถูกต้องจะได้ `403 { code: 'BANNED', banReason, appealToken }` (โทเคนอุทธรณ์อายุ 12 ชม. ใช้ได้กับ `/api/chat/*` เท่านั้น
  และใช้ได้เฉพาะตอนที่ยังถูกแบนอยู่) แล้วหน้า `/suspended` จะแสดงเหตุผล + ปุ่ม **"ติดต่อ Admin / ยื่นเรื่องอุทธรณ์"** เปิดแชตกับ Admin ได้ทันที ส่วนฟังก์ชันอื่นถูกบล็อกทั้งหมด
  (ถูกแบนระหว่างใช้งานอยู่ก็ถูกพามาหน้านี้เช่นกัน) ห้องที่เปิดตอนถูกแบน/ร้านถูกระงับจะติดป้าย **ยื่นอุทธรณ์** ให้ Admin กรองดูได้ · ผู้ที่ถูกแบนเห็นและส่งข้อความได้เฉพาะห้องซัพพอร์ตของตัวเอง
- **ไฟล์แนบในทุกแชต** (แชตซื้อขาย / ติดต่อ Admin / แชตข้อพิพาท ใช้คอมโพเนนต์ชุดเดียวกัน: `components/chat/*`) — ปุ่มคลิปหนีบข้างช่องพิมพ์ (วางรูปจากคลิปบอร์ดได้)
  รูป `.jpg .png .webp` (ย่อด้วย `<canvas>` ≤ 700 KB ก่อนส่ง) และเอกสาร `pdf txt csv doc docx xls xlsx ppt pptx` ≤ 1 MB — เลือกแล้วอัปโหลดทันทีและมี Preview ก่อนกดส่ง ·
  ในห้องแชตรูปแสดงเป็นภาพย่อ กดเพื่อเปิดดูภาพใหญ่ (Lightbox เลื่อนดูรูปอื่น/ดาวน์โหลดได้) ส่วนเอกสารเป็นการ์ดชื่อไฟล์/ขนาด มีปุ่ม "เปิดดู" (PDF/TXT/CSV) และ "ดาวน์โหลด"
- **ความปลอดภัยของไฟล์แนบ** — ส่งเป็น data URL ไป `POST /api/chat/attachments` (body 2 MB เฉพาะเส้นทางนี้) ตรวจ **ชนิดจริงจาก magic bytes + นามสกุล** (PDF, ZIP สำหรับ OOXML, OLE สำหรับ Office เก่า, ข้อความล้วนห้ามมี NUL),
  จำกัด 60 ไฟล์/วัน/บัญชี, ไฟล์เป็น **ส่วนตัว** (ดึงผ่าน `GET /api/chat/files/:id` ต้องมี Authorization และเป็นสมาชิกห้องเท่านั้น ส่ง `nosniff` + `CSP sandbox`) และไฟล์ที่อัปโหลดแล้วไม่ถูกส่งเกิน 24 ชม. จะถูก `jobs/imageCleanup.js` ลบ
- **โครงสร้างข้อมูล** — `Message`: `senderId`, `receiverId` (`null` = ทีม Admin), `conversationId`, `messageType` (`TEXT | IMAGE | FILE`), `text`, `fileUrl`, `fileName/fileMime/fileSize`, `isSupportChat` ·
  `Conversation`: `ownerId`, `peerId`, `type`, `topic`, `status`, ตัวนับข้อความใหม่ของแต่ละฝ่าย · ข้อความในข้อพิพาท (`Dispute.messages`) มีฟิลด์ไฟล์แนบชุดเดียวกัน
- **อื่นๆ** — ดึงข้อความใหม่ทุก 4 วินาที (`?after=<id>` เฉพาะที่ใหม่กว่า, แท็บที่ซ่อนอยู่จะพัก) และโหลดข้อความเก่าด้วย `?before=<id>` · จำกัด 8 ข้อความ/10 วินาที/บัญชี · ข้อความยาว ≤ 1,000 ตัวอักษร ·
  ข้อความที่ยังไม่อ่านขึ้น Badge ที่ไอคอนโปรไฟล์ (`GET /api/notifications` มีรายการ `chat_unread`)

**Validation / ความปลอดภัย**
- ราคาสินค้า ≤ 10,000,000 บาท (ทศนิยมไม่เกิน 2 ตำแหน่ง), สต็อก ≤ 100,000 ชิ้น — สินค้าเก่าที่ราคาเกินเพดาน (ข้อมูลผิดปกติ)
  จะถูกซ่อนจากตลาดจนกว่าผู้ขายจะแก้ราคา และตัวเลขยาวๆ จะตัดบรรทัดเอง (class `.money`) ไม่ดันการ์ดสินค้าทะลุจอ
- ชื่อสินค้า ≤ 100 ตัวอักษร, คำอธิบาย ≤ 1,000 ตัวอักษร (ตรวจทั้ง frontend, backend และ schema) และข้อความยาวจะตัดบรรทัดเอง
  (`word-break` / `white-space: pre-wrap`) ไม่ทะลุหน้าจอ
- เบอร์โทรตรวจตามมาตรฐานไทย: มือถือ `06/08/09` + 8 หลัก (รวม 10 หลัก), เบอร์บ้าน `02/03/04/05/07` + 7 หลัก (รวม 9 หลัก),
  รับรูปแบบ `+66` / `66` / `0066` และเว้นวรรค/ขีด ระบบจะเก็บเป็นรูปแบบ `0XXXXXXXXX` เสมอ (`backend/utils/phone.js`)
- บัญชีที่ถูกแบนจะถูกตัดสิทธิ์ทันที (Middleware ตรวจจากฐานข้อมูลทุก request)
- ลืมรหัสผ่านด้วย OTP 5 หลัก (หมดอายุ 10 นาที, ผิดได้ 5 ครั้ง, ขอใหม่ได้ทุก 30 วินาที, ใช้ได้ครั้งเดียว, เก็บแบบ hash)

> การเติมเงิน/ถอนเงินเป็นระบบจำลอง (ไม่ได้ต่อ Payment Gateway จริง) เหมาะสำหรับ Demo / โปรเจกต์ส่งงาน

## หน้าเว็บหลัก

| หน้า | Path |
|---|---|
| Welcome / Log in / Sign up (Email, User Name, Password, Role) | `/welcome` · `/login` · `/register` |
| ลืมรหัสผ่าน → กรอก OTP → ตั้งรหัสใหม่ | `/forgot-password` → `/forgot-password/otp` → `/forgot-password/reset` |
| Home (แบนเนอร์ + ร้านรีวิวดี + สินค้ายอดนิยม + สินค้า) · ค้นหา · รายละเอียดสินค้า · หน้าร้านค้า | `/` · `/shopping` · `/product/[id]` · `/store/[id]` |
| ตะกร้า · ชำระเงิน · ประวัติคำสั่งซื้อ · โปรไฟล์ · Wallet | `/cart` · `/checkout` · `/history` · `/profile` · `/wallet` |
| Seller Dashboard (`?tab=orders&filter=todo`) · ตั้งค่าร้าน (โลโก้/แบนเนอร์) · เพิ่ม/แก้ไขสินค้า | `/seller` · `/seller/store` · `/seller/products/new` · `/seller/products/[id]` |
| ข้อพิพาท (ผู้ซื้อ/ผู้ขาย: ดูรายละเอียด + แชต + แนบไฟล์) | `/disputes/[id]` |
| กล่องข้อความ · ห้องสนทนา · เริ่มแชต (`?sellerId=&productId=` / `?orderId=` / `?support=1` / `?userId=` สำหรับ Admin) | `/chat` · `/chat/[id]` · `/chat/new` |
| หน้าบัญชีถูกระงับ + ติดต่อ Admin / ยื่นอุทธรณ์ | `/suspended` |
| Admin · จัดการข้อพิพาท · พิจารณาข้อพิพาท | `/admin` · `/admin/disputes` · `/admin/disputes/[id]` |

## รันในเครื่อง

ต้องมี Node.js 20+ และ MongoDB (Atlas หรือติดตั้งในเครื่อง)

```bash
# 1) Backend
cd backend
npm install
cp .env.example .env        # แล้วแก้ MONGO_URI, JWT_SECRET (และ ADMIN_SIGNUP_CODE ถ้าต้องการสมัคร Admin)
npm run seed                # (ไม่บังคับ) สร้างบัญชีและสินค้าตัวอย่าง
npm run dev                 # http://localhost:5000

# 2) Frontend (เปิดอีก terminal)
cd frontend
npm install
cp .env.example .env.local
npm run dev                 # http://localhost:3000
```

บน Windows ใช้ `copy .env.example .env` แทน `cp`

บัญชีตัวอย่างจาก `npm run seed` (รหัสผ่าน `123456` ทุกบัญชี):

| บทบาท | อีเมล | หมายเหตุ |
|---|---|---|
| ผู้ซื้อ | `buyer@solify.test` | Wallet 50,000 บาท |
| ผู้ขาย | `seller@solify.test` | ร้าน "โซลาร์ไทย สโตร์" มีสินค้าตัวอย่าง 5 รายการ (มี 1 รายการเป็นสินค้านอกร้าน) |
| ผู้ขายร้านที่ 2 | `green@solify.test` | ร้าน "กรีนพาวเวอร์ โซลาร์" — seed สร้างออเดอร์ที่สำเร็จแล้วพร้อมรีวิว ให้เห็น "ร้านค้ารีวิวดี" และ "สินค้ายอดนิยม" ในหน้าแรก |
| Admin | `admin@solify.test` | จัดการที่ `/admin` — seed สร้างข้อพิพาทตัวอย่าง 1 รายการ (ออเดอร์ `DISPUTED`) ให้ลองตัดสินที่ `/admin/disputes` |

### การสมัครเป็น Admin
ในหน้า Sign up มีตัวเลือก Role = Seller / Buyer / Admin แต่ **Admin สมัครเองได้ก็ต่อเมื่อ backend ตั้งค่า
`ADMIN_SIGNUP_CODE` ไว้** และผู้สมัครกรอกรหัสนั้นถูกต้องเท่านั้น (ถ้าไม่ตั้งค่า = ปิดการสมัคร Admin ผ่านหน้าเว็บ
เพื่อไม่ให้ใครก็ได้ยกระดับตัวเองเป็น Admin) — สำหรับ Demo ใช้บัญชี `admin@solify.test` จาก seed ได้เลย

### OTP ลืมรหัสผ่าน
- **Demo mode** (ค่าเริ่มต้นเมื่อ `NODE_ENV` ไม่ใช่ `production`, หรือตั้ง `OTP_DEMO_MODE=true`): ระบบไม่ส่งอีเมลจริง
  แต่จะแสดงรหัส OTP บนหน้าจอเพื่อให้ทดสอบ flow ได้ครบ
- **ส่งอีเมลจริง**: ตั้ง `RESEND_API_KEY` และ `MAIL_FROM` (ใช้ [Resend](https://resend.com) ผ่าน `fetch` ในตัว ไม่ต้องติดตั้งแพ็กเกจเพิ่ม)
  แล้วตั้ง `OTP_DEMO_MODE=false`

### ลองเล่น flow Escrow ทั้งวง

1. ล็อกอินเป็นผู้ซื้อ → เลือกสินค้า → ใส่ตะกร้า → ชำระเงิน
2. ล็อกอินเป็นผู้ขาย (อีก browser/โหมดไม่ระบุตัวตน) → แท็บ "ออเดอร์" → ใส่เลขพัสดุ → ยืนยันการจัดส่ง
3. กลับมาเป็นผู้ซื้อ → "คำสั่งซื้อของฉัน" → ยืนยันรับสินค้า
4. ผู้ขายเปิด Wallet จะเห็นเงินเข้า และกด "ถอนเงิน" ได้
5. ผู้ซื้อและผู้ขายให้คะแนน/รีวิวกันได้จากหน้า "คำสั่งซื้อของฉัน" / แท็บออเดอร์ของผู้ขาย (หลังออเดอร์เสร็จสิ้น)
6. ล็อกอินเป็น Admin → `/admin` เพื่อลองแบนผู้ใช้/แบนร้าน/ลบสินค้า
7. ลอง Dispute: ผู้ซื้อกด "ขอเปิดข้อพิพาท" ตอนออเดอร์ `SHIPPED` → Admin ไปที่ `/admin/disputes` ตัดสิน (ต้องกรอกเหตุผล)
8. ลอง Auto-Release โดยไม่ต้องรอ 7 วัน: ตั้ง `AUTO_RELEASE_DAYS=0.001` และ `AUTO_RELEASE_INTERVAL_MINUTES=1` ใน `backend/.env` แล้วรีสตาร์ท
   (ออเดอร์ที่จัดส่งแล้วจะถูกปล่อยเงินภายใน 1-2 นาที)

## ทดสอบ backend

```bash
cd backend
npm test
```

Integration test ครอบคลุม สมัคร/ล็อกอิน (รวม Admin), สิทธิ์ผู้ขาย, ตะกร้า, flow Escrow ครบวง, ยกเลิก/คืนเงิน,
การกดพร้อมกันไม่ให้ขายเกินสต็อก/หักเงินติดลบ, กฎการเงินผู้ขาย (เติมเงินไม่ได้/ถอนได้), เบอร์โทร, ความยาวข้อความ,
ร้านค้า, รีวิว/เรตติ้ง, Admin แบน/ปลดแบน/ลบสินค้า, OTP ลืมรหัสผ่าน,
เพดานราคา/สต็อก, เลขพัสดุ (ตรวจรูปแบบ/ซ้ำ/แก้ไม่ได้), Auto-Release Worker (รวมกรณีกดยืนยันพร้อมกัน), Dispute ของผู้ซื้อ,
Dispute Resolution Panel ของ Admin (สิทธิ์, กรอง/ค้นหา, ตัดสิน 3 แบบ, ต้องมีเหตุผล, ตัดสินซ้ำ/พร้อมกันไม่ได้) และการกู้คืนรายการเงินที่ค้าง
ใช้ MongoDB จำลองในหน่วยความจำ (`mongodb-memory-server`) — ครั้งแรกจะดาวน์โหลดไบนารี MongoDB อัตโนมัติ

## Deploy ขึ้นออนไลน์

ใช้ MongoDB Atlas (ฐานข้อมูล) + Render (backend) + Vercel (frontend) ฟรีทั้งหมด

### 1) MongoDB Atlas
1. สร้าง Cluster ฟรี (M0) → Database Access → สร้าง user/password
2. Network Access → Add IP → `0.0.0.0/0` (Render ไม่มี IP คงที่)
3. Connect → Drivers → คัดลอก connection string แล้วใส่ชื่อ database ต่อท้าย เช่น
   `mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/solify?retryWrites=true&w=majority`
4. (ไม่บังคับ) อยากได้ข้อมูลตัวอย่างบนออนไลน์: ใส่ URI นี้ใน `backend/.env` บนเครื่องแล้วรัน `npm run seed` หนึ่งครั้ง

### 2) Backend บน Render
1. push โปรเจกต์ขึ้น GitHub
2. Render → New → **Blueprint** → เลือก repo (จะอ่านไฟล์ `render.yaml` ให้) หรือ New → Web Service แล้วตั้ง Root Directory = `backend`, Build = `npm install`, Start = `npm start`
3. ตั้ง Environment Variables
   - `MONGO_URI` = connection string จากข้อ 1
   - `JWT_SECRET` = สตริงสุ่มยาวๆ (Blueprint สุ่มให้เอง)
   - `CLIENT_ORIGIN` = โดเมน Vercel ของคุณ เช่น `https://solify.vercel.app` (ยังไม่มีให้ใส่ทีหลังได้ แต่ต้องกลับมาตั้งก่อนใช้งาน)
   - `NODE_ENV` = `production`
   - `ADMIN_SIGNUP_CODE` = รหัสลับสำหรับสมัคร Admin (ไม่ตั้ง = ปิดการสมัคร Admin)
   - `AUTO_RELEASE_DAYS` (ค่าเริ่มต้น 7) · `AUTO_RELEASE_INTERVAL_MINUTES` (ค่าเริ่มต้น 60) · `AUTO_RELEASE_ENABLED` (ค่าเริ่มต้น true)
   - `OTP_DEMO_MODE` = `true` ถ้าเป็น Demo และไม่ได้ต่ออีเมลจริง (บน production ค่าเริ่มต้นคือปิด จึงต้องตั้งเป็น `true` เอง
     หรือกำหนด `RESEND_API_KEY` + `MAIL_FROM`)
4. Deploy เสร็จเปิด `https://<ชื่อ>.onrender.com/api/health` ต้องได้ `{"ok":true}`
   (แพ็กเกจฟรีจะ "หลับ" เมื่อไม่มีคนใช้ ครั้งแรกที่เรียกอาจช้า ~30-50 วินาที — Worker Auto-Release จะรันทันทีตอนเซิร์ฟเวอร์ตื่น
   ออเดอร์ที่ครบกำหนดระหว่างหลับจึงถูกปล่อยเงินหลังจากนั้นไม่นาน)

### 3) Frontend บน Vercel
1. Vercel → Add New Project → เลือก repo เดียวกัน
2. **Root Directory = `frontend`** (Framework: Next.js ตรวจอัตโนมัติ)
3. Environment Variables: `NEXT_PUBLIC_API_URL` = `https://<ชื่อ>.onrender.com/api`
4. Deploy → นำโดเมนที่ได้ไปใส่ `CLIENT_ORIGIN` ที่ Render (คั่น `,` ได้ถ้ามีหลายโดเมน) แล้ว Redeploy backend

ถ้าใช้งานแล้วขึ้น "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้" ให้เช็ก 3 อย่าง: `NEXT_PUBLIC_API_URL` ลงท้าย `/api`, `CLIENT_ORIGIN` ตรงกับโดเมน Vercel เป๊ะ (ไม่มี `/` ท้าย), และ Atlas เปิด `0.0.0.0/0` แล้ว

## โครงสร้างและ API

```
backend/   app.js (Express app) · server.js (เชื่อม DB + listen) · config.js
           routes/ auth · products · cart · wallet · orders · store · reviews · disputes · admin · chat
           jobs/ autoRelease.js (Worker ปล่อยเงินอัตโนมัติ + กู้คืนรายการเงินค้าง)
           models/ (… Order · Dispute · Transaction …) · middleware/ · tests/
           utils/ (phone, ratings, mailer, wallet, escrow, disputes, helpers, chat, attachments)
frontend/  src/app (หน้าเว็บ) · src/components · src/components/chat (ChatRoom, ChatMessages, Composer, ChatAttachment) · src/lib (api, auth, useAuth, limits, phone, chat)
```

| Method | Path | สิทธิ์ | หน้าที่ |
|---|---|---|---|
| POST | `/api/auth/register` `/login` | – | สมัคร (role = buyer/seller/admin*) / เข้าสู่ระบบ |
| GET/PUT | `/api/auth/me` `/profile` | ล็อกอิน | ดู/แก้โปรไฟล์ (รวม `avatarUrl` — `''` = ลบรูป) |
| POST | `/api/uploads` | ล็อกอิน | อัปโหลดรูป `{ kind: avatar\|logo\|banner\|review, dataUrl }` → `{ id, url }` |
| GET | `/api/images/:id` | – | เสิร์ฟรูปที่อัปโหลด |
| GET | `/api/notifications` | ล็อกอิน | งานค้างตามบทบาท `{ total, items[] }` (ใช้แสดง Badge/Dropdown) |
| POST | `/api/auth/forgot-password` `/verify-otp` `/reset-password` | – | ลืมรหัสผ่านด้วย OTP |
| GET | `/api/products` `/:id` | – | รายการ (`?q=`) / รายละเอียด (+`sold`, `rating`, `sellerRating`) |
| GET | `/api/products/popular` | – | สินค้ายอดนิยมตามจำนวนที่ขายได้ (`?limit=`) |
| GET | `/api/products/mine` | seller | สินค้าของร้านฉัน |
| POST/PUT/DELETE | `/api/products` `/:id` | seller (เจ้าของ) | ลง/แก้/ลบสินค้า (`inStore` = แสดงในร้านหรือไม่) |
| PUT | `/api/stores/me` | seller | ตั้งชื่อ/คำอธิบาย/โลโก้ (`storeLogoUrl`)/แบนเนอร์ (`storeBannerUrl`) ร้าน |
| GET | `/api/stores/top` | – | ร้านค้ารีวิวดี (Bayesian) `?limit=` |
| GET | `/api/stores/:sellerId` | – | หน้าร้าน (โลโก้/แบนเนอร์/ขายแล้ว) + สินค้าในร้าน + เรตติ้ง |
| GET/POST/PUT/DELETE | `/api/cart` `/:productId` | buyer | ตะกร้า |
| POST | `/api/orders/checkout` | buyer | ชำระเงิน (คำนวณราคาที่ server, แยก Order ตามผู้ขาย) |
| GET | `/api/orders/mine` `/selling` | ล็อกอิน / seller | คำสั่งซื้อของฉัน / ออเดอร์เข้าร้าน |
| PUT | `/api/orders/:id/ship` | seller | ใส่เลขพัสดุ (ครั้งเดียว/ห้ามซ้ำ) → `SHIPPED` + ตั้ง `autoReleaseAt` |
| PUT | `/api/orders/:id/complete` | buyer | ยืนยันรับสินค้า → ปล่อยเงิน |
| PUT | `/api/orders/:id/cancel` | buyer/seller | ยกเลิกก่อนจัดส่ง → คืนเงิน |
| POST | `/api/disputes` | buyer | เปิดข้อพิพาท (`orderId`, `reason`, `evidenceImages[]`) — ได้เฉพาะ `SHIPPED` → `DISPUTED` |
| GET | `/api/disputes/:id` | ผู้ซื้อ/ผู้ขายของออเดอร์ หรือ admin | รายละเอียดข้อพิพาท + ไทม์ไลน์ + แชต |
| POST | `/api/disputes/:id/messages` | ผู้ซื้อ/ผู้ขาย/admin | ส่งข้อความ/ไฟล์แนบ `{ text?, fileUrl? }` (ก่อนตัดสินเท่านั้น) |
| POST | `/api/reviews` | buyer/seller | รีวิว/ให้ดาว (ได้เมื่อออเดอร์เสร็จสิ้น, ฝั่งละ 1 ครั้งต่อออเดอร์) — ผู้ซื้อแนบ `images[]` ได้ ≤ 4 รูป |
| GET | `/api/reviews/product/:id` `/seller/:id` `/received` | – / ล็อกอิน | รีวิวของสินค้า / ผู้ขาย (`?rating=&withImages=1&page=` + สรุปดาว + แกลเลอรีรูป) / ที่ฉันได้รับ |
| GET | `/api/chat/conversations` | ล็อกอิน (รวมผู้ถูกแบน) | รายการห้องของฉัน (Admin: ห้องซัพพอร์ตทั้งหมด `?unread=1&status=&topic=` + `counts`) |
| POST | `/api/chat/conversations` | buyer/seller | เปิด/หาห้องแชตซื้อขาย `{ sellerId, productId? }` หรือ `{ orderId }` → `{ id }` |
| POST | `/api/chat/support` | ล็อกอิน (รวมผู้ถูกแบน) | เปิด/หาห้องติดต่อ Admin (Admin ส่ง `{ userId }`) — ผู้ถูกแบน/ร้านถูกระงับ = `APPEAL` |
| GET | `/api/chat/conversations/:id` | สมาชิกห้อง / admin | ข้อความ (`?before=` `?after=`) — เปิดอ่านแล้วล้างตัวนับข้อความใหม่ |
| POST | `/api/chat/conversations/:id/messages` | สมาชิกห้อง / admin | ส่งข้อความ `{ text?, fileUrl? }` (อย่างน้อย 1 อย่าง) |
| PUT | `/api/chat/conversations/:id/status` | admin | ปิด/เปิดเรื่องซัพพอร์ต `{ status: OPEN\|CLOSED }` |
| POST | `/api/chat/attachments` | ล็อกอิน | อัปโหลดไฟล์แนบ `{ scope: conversation\|dispute, scopeId, fileName, dataUrl }` → `{ url, name, mime, size, kind }` |
| GET | `/api/chat/files/:id` | สมาชิกห้อง / คู่กรณีข้อพิพาท / admin | ดาวน์โหลด/แสดงไฟล์แนบ (ส่วนตัว ต้องมี Authorization) |
| GET | `/api/wallet` | buyer/seller (admin ไม่มี Wallet → 403) | ยอดคงเหลือ + ประวัติ |
| POST | `/api/wallet/topup` | buyer | เติมเงิน (ไม่เกิน 100,000/ครั้ง) — ผู้ขายถูกปฏิเสธ (403) |
| POST | `/api/wallet/withdraw` | seller | ถอนเงิน (จำลอง) |
| GET | `/api/admin/stats` `/users` `/products` | admin | สถิติ / ผู้ใช้ / สินค้าทั้งหมด |
| PUT | `/api/admin/users/:id/ban` `/unban` | admin | แบน/ปลดแบนบัญชี |
| PUT | `/api/admin/stores/:id/ban` `/unban` | admin | แบน/ปลดแบนร้านค้า |
| DELETE | `/api/admin/products/:id` | admin | ลบสินค้า |
| GET | `/api/admin/disputes` | admin | รายการข้อพิพาท `?status=PENDING\|RESOLVED\|ALL&q=` |
| GET | `/api/admin/disputes/:id` | admin | รายละเอียดข้อพิพาท (รวมข้อมูลติดต่อคู่กรณี) |
| PUT | `/api/admin/disputes/:id/resolve` | admin | ตัดสิน `{ decision: REFUND_BUYER\|PAY_SELLER\|REJECT, adminNote }` |

\* Admin สมัครได้เมื่อกรอกรหัส `ADMIN_SIGNUP_CODE` ถูกต้องเท่านั้น

### ความหมายของ "แบน"
- **แบนบัญชี** — ล็อกอิน/เรียก API ไม่ได้ทันที (ได้รับ `403 BANNED`) และสินค้าของบัญชีนั้นถูกซ่อนจากตลาด — ยกเว้นช่องทางเดียวคือ **แชตติดต่อ Admin / ยื่นอุทธรณ์** (`/suspended` → `/api/chat/*`)
- **แบนร้านค้า** — สินค้าของร้านถูกซ่อน/ซื้อไม่ได้ และผู้ขายลงสินค้าใหม่ไม่ได้ แต่ยังล็อกอิน จัดส่งออเดอร์ที่ค้าง และถอนเงินได้
- แบน Admin ด้วยกันเองไม่ได้ และปลดแบนแล้วสินค้ากลับมาแสดงตามเดิม

## หมายเหตุ

- ไฟล์แนบในแชตเก็บเป็น Buffer ใน MongoDB (collection `attachments`) เหมือนรูปอัปโหลด — เหมาะกับ Demo, งานจริงควรย้ายไป Object Storage · แชตใช้การดึงข้อมูลทุก 4 วินาที (ไม่ใช่ WebSocket) จึงไม่ต้องติดตั้งแพ็กเกจหรือเปิดพอร์ตเพิ่ม
- ผู้ใช้เก่าที่สมัครไว้ก่อนมีการแยกบทบาท (role `user`) จะถูกมองเป็นผู้ซื้อโดยอัตโนมัติ
- รูปสินค้าและรูปหลักฐานข้อพิพาทยังใช้การวางลิงก์ URL — ระบบอัปโหลดรูปรองรับเฉพาะรูปโปรไฟล์ โลโก้/แบนเนอร์ร้าน และรูปรีวิว
- รูปที่อัปโหลดเก็บในฐานข้อมูล MongoDB (เหมาะกับ Demo/ปริมาณน้อย) — ถ้าใช้งานจริงปริมาณมากควรย้ายไปเก็บที่ Object Storage (S3/Cloudinary) แล้วเก็บเฉพาะ URL
- เมื่อ Admin ตัดสินคืนเงินหลังจัดส่ง (`REFUND_BUYER`) ระบบ **ไม่คืนสต็อก** อัตโนมัติ เพราะสินค้าอยู่ระหว่าง/หลังขนส่ง (ผู้ขายแก้สต็อกเองได้)
- ความทนทานของการจ่ายเงิน: การเปลี่ยนสถานะออเดอร์เป็นจุดตัดสินว่าเงินไปทางไหน (atomic) ส่วนการโอนเป็น idempotent
  (unique index `{orderId, type}` บน Transaction + `applied` ใน Wallet) ถ้าเซิร์ฟเวอร์ดับกลางทาง Worker จะกู้คืนให้ (`reconcilePayouts`) โดยไม่จ่ายซ้ำ
- หน้าแรก/หน้าสินค้ายอดนิยม/ร้านรีวิวดีคำนวณจากออเดอร์และรีวิวโดยตรง (Aggregation) ไม่มีแคช — เหมาะกับข้อมูลระดับ Demo ถ้ามีข้อมูลมากควรเพิ่มแคชระยะสั้นหรือคำนวณล่วงหน้า
- การแจ้งเตือนมีเฉพาะ Badge/Dropdown ในหน้าเว็บ (ไม่มีอีเมล/Push) และใช้การดึงข้อมูลเป็นระยะ ไม่ใช่ Real-time
- แบนเนอร์หน้า Home ดึงจากสินค้าที่ผู้ขายลงขายจริง (ไม่มีข้อมูลตายตัว)
- โค้ดชุดล่าสุด (ฟีเจอร์ Admin / ร้านค้า / รีวิว / OTP / หน้า Wireframe) เขียนโดยที่ยังไม่ได้รัน `npm test` และ `next build`
  ในสภาพแวดล้อมที่พัฒนา (ไม่มีอินเทอร์เน็ตสำหรับ `npm install`) — ถ้าพบ error ตอนรันครั้งแรก ให้แจ้งข้อความ error มาแก้ต่อได้
- `backend/routes/escrowRoutes.js` และ `frontend/src/components/Navbar.js` เป็นไฟล์เก่าที่ไม่ได้ใช้แล้ว ลบทิ้งได้
