'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Sun } from 'lucide-react';
import { baht } from '@/lib/auth';

// แบนเนอร์สไลด์ที่แสดง "สินค้าที่ผู้ขายวางขาย" เลื่อนอัตโนมัติ เห็นสไลด์ข้างๆ โผล่ขอบซ้าย-ขวาตาม Wireframe
// ถ้ายังไม่มีสินค้า จะแสดงสไลด์โปรโมตของ Solify แทน
const PROMO = [
  { title: 'แผงโซลาร์เซลล์คุณภาพ', text: 'เลือกซื้ออุปกรณ์โซลาร์จากผู้ขายทั่วไทย', from: 'from-sky-300', to: 'to-amber-100' },
  { title: 'ซื้อปลอดภัยด้วย Escrow', text: 'เงินถูกถือไว้จนกว่าคุณจะได้รับสินค้า', from: 'from-cyan-300', to: 'to-emerald-100' },
  { title: 'เปิดร้านกับ Solify', text: 'สมัครเป็นผู้ขายและลงสินค้าได้ทันที', from: 'from-amber-200', to: 'to-cyan-100' },
];

export default function BannerCarousel({ products = [] }) {
  const ref = useRef(null);
  const pausedRef = useRef(false);
  const [active, setActive] = useState(0);

  const withImage = products.filter((p) => p.imageUrl);
  const picks = (withImage.length >= 3 ? withImage : products).slice(0, 6);
  const slides = picks.length
    ? picks.map((p) => ({ key: p._id, href: `/product/${p._id}`, title: p.name, text: `฿ ${baht(p.price)}`, image: p.imageUrl }))
    : PROMO.map((s) => ({ key: s.title, ...s }));

  const scrollToSlide = useCallback((i) => {
    const el = ref.current;
    const slide = el?.children[i];
    if (!slide) return;
    el.scrollTo({ left: slide.offsetLeft - (el.clientWidth - slide.clientWidth) / 2, behavior: 'smooth' });
  }, []);

  // ตามดูว่าตอนนี้สไลด์ไหนอยู่กลางจอ
  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const center = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    let bestDist = Infinity;
    [...el.children].forEach((c, i) => {
      const d = Math.abs(c.offsetLeft + c.clientWidth / 2 - center);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    setActive(best);
  };

  // เลื่อนอัตโนมัติทุก 3.5 วินาที (หยุดเมื่อผู้ใช้แตะ/เมาส์อยู่เหนือ หรือเปิดโหมดลดการเคลื่อนไหว)
  useEffect(() => {
    if (slides.length < 2) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const timer = setInterval(() => {
      if (pausedRef.current) return;
      scrollToSlide((active + 1) % slides.length);
    }, 3500);
    return () => clearInterval(timer);
  }, [active, slides.length, scrollToSlide]);

  const pause = () => {
    pausedRef.current = true;
  };
  const resume = () => {
    pausedRef.current = false;
  };

  return (
    <div>
      <div
        ref={ref}
        onScroll={onScroll}
        onMouseEnter={pause}
        onMouseLeave={resume}
        onTouchStart={pause}
        onTouchEnd={resume}
        onFocus={pause}
        onBlur={resume}
        className="no-scrollbar flex gap-3 overflow-x-auto snap-x snap-mandatory px-[11%] py-1"
        aria-roledescription="carousel"
        aria-label="สินค้าแนะนำ"
      >
        {slides.map((s, i) => {
          const body = (
            <div
              className={`relative h-44 rounded-lg overflow-hidden shadow-md ${
                s.image ? 'bg-slate-700' : `bg-gradient-to-br ${s.from} ${s.to}`
              }`}
            >
              {s.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.image} alt="" className="absolute inset-0 w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
              ) : (
                <Sun className="absolute right-3 top-3 text-white/70" size={56} />
              )}
              <div
                className={`absolute inset-x-0 bottom-0 p-3 ${
                  s.image ? 'bg-gradient-to-t from-black/70 to-transparent text-white' : 'text-slate-900'
                }`}
              >
                <p className="font-bold text-sm line-clamp-1 text-wrap-safe">{s.title}</p>
                <p className="text-xs opacity-90 line-clamp-1 text-wrap-safe">{s.text}</p>
              </div>
            </div>
          );
          return (
            <div key={s.key} className="snap-center shrink-0 w-[78%]" aria-label={`สไลด์ ${i + 1} จาก ${slides.length}`}>
              {s.href ? <Link href={s.href}>{body}</Link> : body}
            </div>
          );
        })}
      </div>

      {slides.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2" role="tablist" aria-label="เลือกสไลด์">
          {slides.map((s, i) => (
            <button
              key={s.key}
              role="tab"
              aria-selected={i === active}
              aria-label={`ไปสไลด์ ${i + 1}`}
              onClick={() => scrollToSlide(i)}
              className={`h-1.5 rounded-full transition-all ${i === active ? 'w-5 bg-slate-700' : 'w-1.5 bg-slate-400'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
