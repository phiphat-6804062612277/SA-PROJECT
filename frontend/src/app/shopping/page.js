'use client';
import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import API from '@/lib/api';
import AppHeader from '@/components/AppHeader';
import ProductCard from '@/components/ProductCard';
import TopStores from '@/components/TopStores';
import PopularProducts from '@/components/PopularProducts';
import Loading from '@/components/Loading';

// ตัวกรอง/การเรียงลำดับ — มี fn = เรียงรายการสินค้าตามปกติ, ไม่มี fn (stores / popular) = สลับไปแสดงส่วนของตัวเอง
const SORTS = {
  new: { label: 'ใหม่ล่าสุด', fn: (a, b) => new Date(b.createdAt) - new Date(a.createdAt) },
  low: { label: 'ราคาต่ำ → สูง', fn: (a, b) => a.price - b.price },
  high: { label: 'ราคาสูง → ต่ำ', fn: (a, b) => b.price - a.price },
  stores: { label: 'ร้านค้ารีวิวดี / ยอดนิยม' },
  popular: { label: 'สินค้ายอดนิยม' },
};

function Shopping() {
  const params = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState(params.get('q') || '');
  const [sort, setSort] = useState('new');

  useEffect(() => {
    API.get('/products')
      .then((res) => setProducts(Array.isArray(res.data) ? res.data : []))
      .catch(() => setError('ไม่สามารถโหลดรายการสินค้าได้'))
      .finally(() => setLoading(false));
  }, []);

  const keyword = search.trim().toLowerCase();
  const sortFn = SORTS[sort]?.fn; // ไม่มี = โหมด stores / popular
  const shown = sortFn
    ? products.filter((p) => (p.name || '').toLowerCase().includes(keyword)).sort(sortFn)
    : [];

  return (
    <div className="bg-[#dcf0f1] min-h-screen">
      <AppHeader title="สินค้าทั้งหมด" />

      <div className="p-4 space-y-4">
        <div className="relative">
          <input
            type="search"
            aria-label="ค้นหาสินค้า"
            placeholder="ค้นหาสินค้า..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-full py-2 pl-4 pr-10 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
          />
          <Search className="absolute right-3 top-2.5 text-slate-400 w-4 h-4" />
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">{sortFn && !loading ? `${shown.length} รายการ` : ''}</span>
          <select
            aria-label="เรียงลำดับ"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="bg-white border border-slate-300 rounded-full px-3 py-1 text-slate-700"
          >
            {Object.entries(SORTS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>

        {sort === 'stores' ? (
          <TopStores layout="grid" limit={20} query={search} />
        ) : sort === 'popular' ? (
          <PopularProducts limit={20} showEmpty query={search} />
        ) : loading ? (
          <Loading text="กำลังโหลดรายการสินค้า..." />
        ) : error ? (
          <div className="text-center py-12 text-sm text-red-500">{error}</div>
        ) : shown.length === 0 ? (
          <div className="text-center py-12 text-sm text-slate-500">{keyword ? 'ไม่พบสินค้าที่ค้นหา' : 'ยังไม่มีสินค้าในระบบ'}</div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {shown.map((p) => (
              <ProductCard key={p._id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ShoppingPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Shopping />
    </Suspense>
  );
}
