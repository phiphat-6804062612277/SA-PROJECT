import { BadgeCheck, ThumbsUp, Sparkles, CircleAlert, User } from 'lucide-react';

// ป้ายความน่าเชื่อถือของ "ผู้ซื้อ" — คำนวณจากคะแนนที่ผู้ขายเคยให้ผู้ซื้อคนนั้น (ดู backend utils/ratings.js trustLevel)
const STYLE = {
  trusted: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: BadgeCheck },
  good: { cls: 'bg-cyan-50 text-cyan-700 border-cyan-200', Icon: ThumbsUp },
  normal: { cls: 'bg-slate-50 text-slate-600 border-slate-200', Icon: User },
  new: { cls: 'bg-slate-50 text-slate-500 border-slate-200', Icon: Sparkles },
  caution: { cls: 'bg-amber-50 text-amber-700 border-amber-200', Icon: CircleAlert },
};

/**
 * trust = { avg, count, level, label } จาก API
 *   compact → แสดงเฉพาะป้าย (ใช้ในรายการรีวิว)   ปิด compact → แสดงคะแนนเฉลี่ยจากผู้ขายต่อท้ายด้วย
 */
export default function TrustBadge({ trust, compact = false }) {
  if (!trust) return null;
  const { cls, Icon } = STYLE[trust.level] || STYLE.normal;
  const score = trust.count ? `★ ${Number(trust.avg).toFixed(1)} จาก ${trust.count} รีวิวของผู้ขาย` : 'ยังไม่มีรีวิวจากผู้ขาย';
  return (
    <span
      title={score}
      className={`inline-flex items-center gap-1 border rounded-full font-bold whitespace-nowrap ${cls} ${compact ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5'}`}
    >
      <Icon size={compact ? 10 : 12} />
      {trust.label}
      {trust.count > 0 && <span className="font-semibold opacity-80">· ★{Number(trust.avg).toFixed(1)} ({trust.count})</span>}
    </span>
  );
}
