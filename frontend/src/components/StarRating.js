'use client';
import { Star } from 'lucide-react';

// แสดงดาวคะแนน (อ่านอย่างเดียว) รองรับทศนิยม เช่น 4.5
export function Stars({ value = 0, size = 14 }) {
  return (
    <span className="inline-flex" role="img" aria-label={`คะแนน ${value} จาก 5`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)));
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star size={size} className="text-slate-300" />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star size={size} className="text-amber-400 fill-amber-400" />
            </span>
          </span>
        );
      })}
    </span>
  );
}

// คะแนนเฉลี่ย + จำนวนรีวิว เช่น ★★★★☆ 4.5 (12 รีวิว)
export function RatingSummary({ rating, size = 14, emptyText = 'ยังไม่มีรีวิว' }) {
  if (!rating || !rating.count) return <span className="text-[11px] text-slate-400">{emptyText}</span>;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-slate-600">
      <Stars value={rating.avg} size={size} />
      <b className="text-slate-800">{rating.avg.toFixed(1)}</b>
      <span>({rating.count} รีวิว)</span>
    </span>
  );
}

// ให้คะแนนโดยกดเลือกดาว
export function StarInput({ value, onChange }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="ให้คะแนน">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${i} ดาว`}
          onClick={() => onChange(i)}
          className="p-0.5"
        >
          <Star size={28} className={i <= value ? 'text-amber-400 fill-amber-400' : 'text-slate-300'} />
        </button>
      ))}
    </div>
  );
}
