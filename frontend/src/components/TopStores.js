'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy, Star, Package } from 'lucide-react';
import API from '@/lib/api';
import Avatar from '@/components/Avatar';
import { imageSrc } from '@/lib/image';

const RANK_STYLE = ['bg-amber-400 text-amber-950', 'bg-slate-300 text-slate-800', 'bg-orange-300 text-orange-950'];

/**
 * ส่วน "ร้านค้ารีวิวดี / ยอดนิยม" — กดการ์ดเพื่อเข้าหน้าร้านของผู้ขายนั้นโดยตรง
 *   layout="scroll" (ค่าเริ่มต้น, หน้า Home): การ์ดเลื่อนแนวนอน — ซ่อนทั้งส่วนถ้ายังไม่มีร้านที่มีรีวิว
 *   layout="grid"   (หน้า Shopping เมื่อเลือกตัวกรอง "ร้านคะแนนดี"): เรียง 2 คอลัมน์ + แสดงข้อความเมื่อว่าง
 *   query = คำค้น (กรองตามชื่อร้าน — เฉพาะที่โหลดมาแล้ว)
 */
export default function TopStores({ limit = 8, className = '', layout = 'scroll', query = '' }) {
  const [stores, setStores] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const grid = layout === 'grid';

  useEffect(() => {
    let alive = true;
    API.get('/stores/top', { params: { limit } })
      .then((res) => alive && setStores(Array.isArray(res.data) ? res.data : []))
      .catch(() => alive && setStores([]))
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [limit]);

  const q = query.trim().toLowerCase();
  // อันดับ (#1, #2, ...) ยึดตามอันดับจริงของระบบ แม้กำลังกรองด้วยคำค้น
  const ranked = stores.map((s, i) => ({ ...s, rank: i + 1 })).filter((s) => !q || (s.name || '').toLowerCase().includes(q));

  if (grid && !loaded) return <div className="text-center py-16 text-sm text-slate-500">กำลังโหลดร้านค้า...</div>;
  if (ranked.length === 0) {
    if (!grid) return null;
    return (
      <div className="text-center py-12 text-sm text-slate-500">
        {q ? 'ไม่พบร้านค้าที่ค้นหา' : 'ยังไม่มีร้านค้าที่ได้รับรีวิว'}
      </div>
    );
  }

  return (
    <section className={className} aria-label="ร้านค้ารีวิวดี">
      <div className="flex items-center gap-1.5 mb-3">
        <Trophy size={16} className="text-amber-500" />
        <h2 className="font-bold text-sm text-slate-800">ร้านค้ารีวิวดี / ยอดนิยม</h2>
      </div>
      <div className={grid ? 'grid grid-cols-2 gap-3' : 'flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-1 px-1 snap-x'}>
        {ranked.map((s) => (
          <Link
            key={s.id}
            href={`/store/${s.id}`}
            className={`bg-white rounded-2xl shadow-sm hover:shadow-md transition overflow-hidden block ${grid ? 'min-w-0' : 'snap-start shrink-0 w-40'}`}
          >
            <div className="relative h-16 bg-gradient-to-br from-[#9bdadd] via-cyan-200 to-sky-300">
              {s.bannerUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageSrc(s.bannerUrl)} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
              )}
              <span className={`absolute top-1.5 left-1.5 text-[10px] font-black px-1.5 py-0.5 rounded-full ${RANK_STYLE[s.rank - 1] || 'bg-white/90 text-slate-700'}`}>
                #{s.rank}
              </span>
            </div>
            <div className="px-3 pb-3">
              {/* relative z-10: ให้โลโก้อยู่เหนือแบนเนอร์ (แบนเนอร์เป็น relative จึงวาดทับโลโก้ถ้าไม่ตั้ง z-index) */}
              <div className="-mt-6 relative z-10">
                <Avatar src={s.logoUrl} name={s.name} size={48} className="ring-4 ring-white" />
              </div>
              <h3 className="mt-1 text-xs font-bold text-slate-800 truncate">{s.name}</h3>
              <p className="flex items-center gap-1 text-[11px] text-slate-600 mt-0.5">
                <Star size={12} className="text-amber-400 fill-amber-400" />
                <b className="text-slate-800">{s.rating.avg.toFixed(1)}</b>
                <span className="text-slate-400">({s.rating.count} รีวิว)</span>
              </p>
              <p className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                <Package size={11} /> {s.productCount} สินค้า
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
