'use client';
import { useEffect, useState } from 'react';
import { Flame } from 'lucide-react';
import API from '@/lib/api';
import ProductCard from '@/components/ProductCard';

/**
 * ส่วน "สินค้ายอดนิยม" — เรียงตามจำนวนที่ขายได้
 *   ค่าเริ่มต้น (หน้า Home): ซ่อนทั้งส่วนถ้ายังไม่มียอดขาย
 *   showEmpty (หน้า Shopping เมื่อเลือกตัวกรอง "สินค้ายอดนิยม"): แสดงข้อความแทนเมื่อว่าง + รอโหลดก่อน
 *   query = คำค้น (กรองตามชื่อสินค้า — เฉพาะที่โหลดมาแล้ว)
 */
export default function PopularProducts({ limit = 4, className = '', showEmpty = false, query = '' }) {
  const [products, setProducts] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    API.get('/products/popular', { params: { limit } })
      .then((res) => alive && setProducts(Array.isArray(res.data) ? res.data : []))
      .catch(() => alive && setProducts([]))
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [limit]);

  const q = query.trim().toLowerCase();
  const shown = q ? products.filter((p) => (p.name || '').toLowerCase().includes(q)) : products;

  if (showEmpty && !loaded) return <div className="text-center py-16 text-sm text-slate-500">กำลังโหลดสินค้ายอดนิยม...</div>;
  if (shown.length === 0) {
    if (!showEmpty) return null;
    return (
      <div className="text-center py-12 text-sm text-slate-500">
        {q ? 'ไม่พบสินค้าที่ค้นหา' : 'ยังไม่มีสินค้าที่มียอดขาย'}
      </div>
    );
  }

  return (
    <section className={className} aria-label="สินค้ายอดนิยม">
      <div className="flex items-center gap-1.5 mb-3">
        <Flame size={16} className="text-orange-500" />
        <h2 className="font-bold text-sm text-slate-800">สินค้ายอดนิยม</h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {shown.map((p) => (
          <ProductCard key={p._id} product={p} />
        ))}
      </div>
    </section>
  );
}
