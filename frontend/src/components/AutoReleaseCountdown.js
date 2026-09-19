'use client';
import { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';

// แปลงเวลาที่เหลือเป็นข้อความ เช่น "6 วัน 23 ชม." / "5 ชม. 12 นาที" / "ไม่ถึง 1 นาที"
export function formatRemaining(ms) {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d} วัน ${h} ชม.`;
  if (h > 0) return `${h} ชม. ${m} นาที`;
  return m > 0 ? `${m} นาที` : 'ไม่ถึง 1 นาที';
}

// นับถอยหลังการปล่อยเงินอัตโนมัติ (Auto-Release) ของออเดอร์ที่จัดส่งแล้ว
export default function AutoReleaseCountdown({ at, role = 'buyer' }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);
  if (!at) return null;

  const ms = new Date(at).getTime() - now;
  const due = ms <= 0;
  const when = new Date(at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="flex gap-2 items-start bg-sky-50 border border-sky-100 rounded-xl p-2.5 text-[11px] text-sky-800">
      <Timer size={14} className="shrink-0 mt-0.5" />
      <p className="text-wrap-safe">
        {due ? (
          'ครบกำหนดแล้ว — ระบบกำลังปล่อยเงินให้ผู้ขายอัตโนมัติ (ตรวจทุก 1 ชั่วโมง)'
        ) : role === 'seller' ? (
          <>
            เงินจะเข้า Wallet ของคุณอัตโนมัติใน <b>{formatRemaining(ms)}</b> ({when}) หากผู้ซื้อไม่เปิดข้อพิพาท
          </>
        ) : (
          <>
            ระบบจะปล่อยเงินให้ผู้ขายอัตโนมัติใน <b>{formatRemaining(ms)}</b> ({when}) หากคุณไม่ยืนยันรับสินค้าหรือเปิดข้อพิพาทก่อน
          </>
        )}
      </p>
    </div>
  );
}
