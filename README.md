# ☀️ Solify — ตลาดซื้อขาย Solar Cell ระบบ Escrow

Next.js 16 (frontend) + Express 5 / MongoDB (backend)

## ฟีเจอร์

**ผู้ซื้อ** — สมัคร/เข้าสู่ระบบ · ค้นหาและดูสินค้า · ตะกร้า (เก็บบน server) · เติมเงินเข้า Wallet ·
ชำระเงินผ่าน Wallet · ติดตามคำสั่งซื้อ/เลขพัสดุ · ยืนยันรับสินค้า · ยกเลิกก่อนจัดส่ง (คืนเงิน)

**ผู้ขาย** (เลือกบทบาทตอนสมัคร) — ลง/แก้ไข/ลบสินค้า · ดูออเดอร์ที่เข้ามา · ใส่เลขพัสดุ · ปฏิเสธออเดอร์ (คืนเงินผู้ซื้อ) · ถอนเงินจาก Wallet

**Escrow** — จ่ายเงิน → ระบบถือเงิน (`HELD`) → ผู้ขายจัดส่ง → ผู้ซื้อกดยืนยันรับ → โอนเงินเข้า Wallet ผู้ขาย (`RELEASED`)
ยกเลิกได้เฉพาะก่อนจัดส่ง → คืนเงิน (`REFUNDED`) และคืนสต็อก

> การเติมเงิน/ถอนเงินเป็นระบบจำลอง (ไม่ได้ต่อ Payment Gateway จริง) เหมาะสำหรับ Demo / โปรเจกต์ส่งงาน

## รันในเครื่อง

ต้องมี Node.js 20+ และ MongoDB (Atlas หรือติดตั้งในเครื่อง)

```bash
# 1) Backend
cd backend
npm install
cp .env.example .env        # แล้วแก้ MONGO_URI และ JWT_SECRET
npm run seed                # (ไม่บังคับ) สร้างบัญชีและสินค้าตัวอย่าง
npm run dev                 # http://localhost:5000

# 2) Frontend (เปิดอีก terminal)
cd frontend
npm install
cp .env.example .env.local
npm run dev                 # http://localhost:3000
```

บน Windows ใช้ `copy .env.example .env` แทน `cp`

บัญชีตัวอย่างจาก `npm run seed` (รหัสผ่าน `123456` ทั้งคู่):

| บทบาท | อีเมล | หมายเหตุ |
|---|---|---|
| ผู้ซื้อ | `buyer@solify.test` | Wallet 50,000 บาท |
| ผู้ขาย | `seller@solify.test` | มีสินค้าตัวอย่าง 4 รายการ |

### ลองเล่น flow Escrow ทั้งวง

1. ล็อกอินเป็นผู้ซื้อ → เลือกสินค้า → ใส่ตะกร้า → ชำระเงิน
2. ล็อกอินเป็นผู้ขาย (อีก browser/โหมดไม่ระบุตัวตน) → แท็บ "ออเดอร์" → ใส่เลขพัสดุ → ยืนยันการจัดส่ง
3. กลับมาเป็นผู้ซื้อ → "คำสั่งซื้อของฉัน" → ยืนยันรับสินค้า
4. ผู้ขายเปิด Wallet จะเห็นเงินเข้า และกด "ถอนเงิน" ได้

## ทดสอบ backend

```bash
cd backend
npm test
```

Integration test ครอบคลุม สมัคร/ล็อกอิน, สิทธิ์ผู้ขาย, ตะกร้า, flow Escrow ครบวง, ยกเลิก/คืนเงิน,
การกดพร้อมกันไม่ให้ขายเกินสต็อก/หักเงินติดลบ ฯลฯ
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
4. Deploy เสร็จเปิด `https://<ชื่อ>.onrender.com/api/health` ต้องได้ `{"ok":true}`
   (แพ็กเกจฟรีจะ "หลับ" เมื่อไม่มีคนใช้ ครั้งแรกที่เรียกอาจช้า ~30-50 วินาที)

### 3) Frontend บน Vercel
1. Vercel → Add New Project → เลือก repo เดียวกัน
2. **Root Directory = `frontend`** (Framework: Next.js ตรวจอัตโนมัติ)
3. Environment Variables: `NEXT_PUBLIC_API_URL` = `https://<ชื่อ>.onrender.com/api`
4. Deploy → นำโดเมนที่ได้ไปใส่ `CLIENT_ORIGIN` ที่ Render (คั่น `,` ได้ถ้ามีหลายโดเมน) แล้ว Redeploy backend

ถ้าใช้งานแล้วขึ้น "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้" ให้เช็ก 3 อย่าง: `NEXT_PUBLIC_API_URL` ลงท้าย `/api`, `CLIENT_ORIGIN` ตรงกับโดเมน Vercel เป๊ะ (ไม่มี `/` ท้าย), และ Atlas เปิด `0.0.0.0/0` แล้ว

## โครงสร้างและ API

```
backend/   app.js (Express app) · server.js (เชื่อม DB + listen) · config.js
           routes/ auth · products · cart · wallet · orders   models/ · middleware/ · utils/ · tests/
frontend/  src/app (หน้าเว็บ) · src/components · src/lib (api, auth, useAuth)
```

| Method | Path | สิทธิ์ | หน้าที่ |
|---|---|---|---|
| POST | `/api/auth/register` `/login` | – | สมัคร (role = buyer/seller) / เข้าสู่ระบบ |
| GET/PUT | `/api/auth/me` `/profile` | ล็อกอิน | ดู/แก้โปรไฟล์ |
| GET | `/api/products` `/:id` | – | รายการ (`?q=`) / รายละเอียด |
| GET | `/api/products/mine` | seller | สินค้าของร้านฉัน |
| POST/PUT/DELETE | `/api/products` `/:id` | seller (เจ้าของ) | ลง/แก้/ลบสินค้า |
| GET/POST/PUT/DELETE | `/api/cart` `/:productId` | buyer | ตะกร้า |
| POST | `/api/orders/checkout` | buyer | ชำระเงิน (คำนวณราคาที่ server, แยก Order ตามผู้ขาย) |
| GET | `/api/orders/mine` `/selling` | ล็อกอิน / seller | คำสั่งซื้อของฉัน / ออเดอร์เข้าร้าน |
| PUT | `/api/orders/:id/ship` | seller | ใส่เลขพัสดุ |
| PUT | `/api/orders/:id/complete` | buyer | ยืนยันรับสินค้า → ปล่อยเงิน |
| PUT | `/api/orders/:id/cancel` | buyer/seller | ยกเลิกก่อนจัดส่ง → คืนเงิน |
| GET | `/api/wallet` | ล็อกอิน | ยอดคงเหลือ + ประวัติ |
| POST | `/api/wallet/topup` `/withdraw` | ล็อกอิน | เติม (ไม่เกิน 100,000/ครั้ง) / ถอนเงิน (จำลอง) |

## หมายเหตุ

- ผู้ใช้เก่าที่สมัครไว้ก่อนมีการแยกบทบาท (role `user`) จะถูกมองเป็นผู้ซื้อโดยอัตโนมัติ
- รูปสินค้าใช้การวางลิงก์ URL (ยังไม่มีระบบอัปโหลดไฟล์)
- `backend/routes/escrowRoutes.js` และ `frontend/src/components/Navbar.js` เป็นไฟล์เก่าที่ไม่ได้ใช้แล้ว ลบทิ้งได้
