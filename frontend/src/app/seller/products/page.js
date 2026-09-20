'use client';
import { Suspense, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
import API, { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import PageHeader from '@/components/PageHeader';
import Loading from '@/components/Loading';
import Notice from '@/components/Notice';
import SellerProductRow from '@/components/seller/SellerProductRow';
import { Chip, PRODUCT_FILTERS, countBy } from '@/components/seller/SellerParts';

// จัดการสินค้าของร้าน (เมนู "สินค้า"): ค้นหา / กรอง / สลับในร้าน-นอกร้าน / แก้ไข / ลบ / ลงขายสินค้าใหม่  (?filter=low = สต็อกต่ำ)
function SellerProducts() {
  const { user } = useAuth({ roles: ['seller'] });
  const params = useSearchParams();
  const initial = params.get('filter');
  const [products, setProducts] = useState(null);
  const [filter, setFilter] = useState(PRODUCT_FILTERS.some((f) => f.key === initial) ? initial : 'all');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setProducts((await API.get('/products/mine')).data);
      setError('');
    } catch (err) {
      setProducts((prev) => prev || []);
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (!user || products === null) return <Loading />;

  const kw = search.trim().toLowerCase();
  const shown = products.filter(PRODUCT_FILTERS.find((f) => f.key === filter).test).filter((p) => !kw || p.name.toLowerCase().includes(kw));

  return (
    <div className="bg-[#dcf0f1] min-h-screen pb-6">
      <PageHeader
        title="สินค้าของร้าน"
        right={
          <Link href="/seller/products/new" aria-label="ลงขายสินค้าใหม่" className="inline-flex items-center gap-1 bg-slate-800 text-white text-[11px] font-bold px-3 py-1.5 rounded-full">
            <Plus size={14} /> ลงขาย
          </Link>
        }
      />
      <div className="p-4 space-y-3">
        <Notice type="error">{error}</Notice>
        <div className="relative">
          <input
            type="search"
            aria-label="ค้นหาสินค้าในร้าน"
            placeholder="ค้นหาสินค้าในร้าน..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-full py-2 pl-4 pr-10 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
          />
          <Search className="absolute right-3 top-2.5 text-slate-400 w-4 h-4" />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {PRODUCT_FILTERS.map((f) => (
            <Chip key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)} count={countBy(products, f.key, PRODUCT_FILTERS)}>
              {f.label}
            </Chip>
          ))}
        </div>

        {shown.length === 0 ? (
          <div className="text-center py-10 space-y-3">
            <p className="text-sm text-slate-400">{products.length === 0 ? 'ยังไม่มีสินค้าในร้าน' : 'ไม่พบสินค้าที่ตรงเงื่อนไข'}</p>
            {products.length === 0 && (
              <Link href="/seller/products/new" className="inline-block bg-[#9bdadd] text-slate-900 font-bold px-5 py-2 rounded-full text-xs">
                ลงขายสินค้าชิ้นแรก
              </Link>
            )}
          </div>
        ) : (
          shown.map((p) => <SellerProductRow key={p._id} product={p} onChanged={load} />)
        )}
      </div>
    </div>
  );
}

export default function SellerProductsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <SellerProducts />
    </Suspense>
  );
}
