'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import API from '@/lib/api';
import { baht } from '@/lib/auth';
import ProductImage from '@/components/ProductImage';
import PageHeader from '@/components/PageHeader';
import Loading from '@/components/Loading';

export default function ShoppingPage() {
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

  const filtered = products.filter((p) => (p.name || '').toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="bg-[#e0f7f7] min-h-screen pb-4">
      <PageHeader title="Solify Shopping" />

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

        {loading ? (
          <Loading text="กำลังโหลดรายการสินค้า..." />
        ) : error ? (
          <div className="text-center py-12 text-sm text-red-500">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-sm text-slate-500">
            {search ? 'ไม่พบสินค้าที่ค้นหา' : 'ยังไม่มีสินค้าในระบบ'}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((p) => (
              <Link key={p._id} href={`/product/${p._id}`}>
                <div className="bg-[#d5e8e8] rounded-2xl p-2 shadow-sm hover:shadow-md transition flex flex-col justify-between h-full">
                  <ProductImage src={p.imageUrl} alt={p.name} className="w-full h-32 rounded-xl" />
                  <div className="mt-2">
                    <h3 className="font-semibold text-xs text-slate-800 line-clamp-2">{p.name}</h3>
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-xs font-bold text-slate-900">฿ {baht(p.price)}</p>
                      {p.stock < 1 && <span className="text-[10px] font-bold text-red-500">หมด</span>}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
