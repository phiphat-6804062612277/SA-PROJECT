'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import API from '@/lib/api';
import AppHeader from '@/components/AppHeader';
import BannerCarousel from '@/components/BannerCarousel';
import ProductCard from '@/components/ProductCard';
import TopStores from '@/components/TopStores';
import PopularProducts from '@/components/PopularProducts';

// หน้า Home (ผู้ซื้อ) ตาม Wireframe: เมนู ☰ → ช่องค้นหา → แบนเนอร์สินค้าเลื่อนไปมา → สินค้าที่ผู้ขายวางขาย
export default function Home() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    API.get('/products')
      .then((res) => setProducts(Array.isArray(res.data) ? res.data : []))
      .catch(() => setError('ไม่สามารถโหลดรายการสินค้าได้'))
      .finally(() => setLoading(false));
  }, []);

  const keyword = search.trim().toLowerCase();
  const filtered = keyword ? products.filter((p) => (p.name || '').toLowerCase().includes(keyword)) : products;
  const shown = keyword ? filtered : filtered.slice(0, 20);

  return (
    <div className="min-h-screen bg-[#dcf0f1]">
      <AppHeader />

      {/* ช่องค้นหา */}
      <div className="bg-[#f0ffff] px-7 py-5">
        <div className="bg-[#adc8d0] rounded-full p-2">
          <div className="relative">
            <input
              type="search"
              aria-label="ค้นหาสินค้า"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-slate-900 rounded-full py-2.5 pl-5 pr-11 text-sm text-slate-800 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-900" size={20} />
          </div>
        </div>
      </div>

      {/* แบนเนอร์สินค้า (ซ่อนตอนกำลังค้นหา) */}
      {!keyword && (
        <div className="bg-[#d5ecec] pt-4 pb-3">
          <BannerCarousel products={products} />
        </div>
      )}
      {!keyword && <div className="bg-[#f0ffff] h-5" />}

      {/* ร้านค้ารีวิวดี + สินค้ายอดนิยม (ซ่อนตอนกำลังค้นหา / ซ่อนเองถ้ายังไม่มีข้อมูล) */}
      {!keyword && (
        <div className="px-5 pt-5 space-y-6">
          <TopStores limit={8} />
          <PopularProducts limit={4} />
        </div>
      )}

      {/* สินค้าที่ผู้ขายวางขาย */}
      <section className="px-5 py-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-sm text-slate-800">{keyword ? `ผลการค้นหา (${filtered.length})` : 'สินค้าจากผู้ขาย'}</h2>
          {!keyword && (
            <Link href="/shopping" className="text-xs font-bold text-cyan-700">ดูทั้งหมด</Link>
          )}
        </div>

        {loading ? (
          <p className="text-center text-xs text-slate-500 py-10">กำลังโหลดสินค้า...</p>
        ) : error ? (
          <p className="text-center text-xs text-red-500 py-10">{error}</p>
        ) : shown.length === 0 ? (
          <p className="text-center text-xs text-slate-500 py-10">{keyword ? 'ไม่พบสินค้าที่ค้นหา' : 'ยังไม่มีสินค้าในระบบ'}</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {shown.map((p) => (
              <ProductCard key={p._id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
