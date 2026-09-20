import { Lock } from 'lucide-react';

/** ป้ายสถานะห้องแชต: OPEN (เปิดอยู่) / CLOSED (ปิดแล้ว = อ่านอย่างเดียว) — ใช้ร่วมกันทุกห้อง (ซื้อขาย / ติดต่อ Admin / ข้อพิพาท) */
export function StatusPill({ status = 'OPEN' }) {
  const closed = status === 'CLOSED';
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-black tracking-wide px-2 py-0.5 rounded-full ${closed ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}
      aria-label={closed ? 'สถานะแชต: ปิดแล้ว' : 'สถานะแชต: เปิดอยู่'}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${closed ? 'bg-slate-500' : 'bg-emerald-500'}`} aria-hidden="true" />
      {closed ? 'CLOSED' : 'OPEN'}
    </span>
  );
}

/** Banner "การสนทนานี้ถูกปิดแล้ว" — ช่องพิมพ์ถูกล็อก อ่านได้อย่างเดียว */
export function ClosedBanner({ children, className = '' }) {
  return (
    <div role="status" className={`flex gap-2 items-start bg-slate-100 border border-slate-200 text-slate-600 rounded-xl px-3 py-2 text-[11px] ${className}`}>
      <Lock size={14} className="shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1 space-y-0.5 text-wrap-safe">
        <p className="font-bold text-slate-700">การสนทนานี้ถูกปิดแล้ว</p>
        {children}
      </div>
    </div>
  );
}
