'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import API from '@/lib/api';
import { baht } from '@/lib/auth';
import PageHeader from '@/components/PageHeader';
import ProductCard from '@/components/ProductCard';
import ReviewSection from '@/components/ReviewSection';
import StoreHero from '@/components/StoreHero';
import Loading from '@/components/Loading';
import { RatingSummary } from '@/components/StarRating';

const SORTS = [
  { key: 'new', label: 'ล่าสุด', fn: () => 0 }, // API เรียงใหม่สุดมาก่อนอยู่แล้ว
  { key: 'sold', label: 'ขายดี', fn: (a, b) => (b.sold || 0) - (a.sold || 0) },
  { key: 'low', label: 'ราคาต่ำ→สูง', fn: (a, b) => a.price - b.price },
  { key: 'high', label: 'ราคาสูง→ต่ำ', fn: (a, b) => b.price - a.price },
];

// หน้าร้านค้า (สาธารณะ): แบนเนอร์/โลโก้ + คะแนน + สถิติ + แท็บ "สินค้า" / "รีวิวร้านค้า"
export default function StorePage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [rating, setRating] = useState({ avg: 0, count: 0 });
  const [state, setState] = useState('loading'); // loading | ok | missing
  const [tab, setTab] = useState('products');
  const [sort, setSort] = useState('new');

  useEffect(() => {
    if (!id) return;
    API.get(`/stores/${id}`)
      .then((res) => {
        setData(res.data);
        setRating(res.data.rating || { avg: 0, count: 0 });
        setState('ok');
      })
      .catch(() => setState('missing'));
  }, [id]);

  const products = useMemo(() => {
    if (!data) return [];
    const fn = SORTS.find((s) => s.key === sort).fn;
    return [...data.products].sort(fn);
  }, [data, sort]);

  if (state === 'loading') return <Loading />;
  if (state === 'missing') {
    return (
      <div>
        <PageHeader title="ร้านค้า" back />
        <p className="p-10 text-center text-sm text-slate-500">ไม่พบร้านค้า หรือร้านค้านี้ถูกระงับการใช้งาน</p>
      </div>
    );
  }

  const { store } = data;
  return (
    <div className="bg-[#dcf0f1] min-h-screen pb-6">
      <PageHeader title={store.name} back />

      <div className="p-4 space-y-4">
        <StoreHero
          name={store.name}
          logoUrl={store.logoUrl}
          bannerUrl={store.bannerUrl}
          subtitle={`โดย ${store.ownerName} · เปิดร้านตั้งแต่ ${new Date(store.since).toLocaleDateString('th-TH', { month: 'short', year: 'numeric' })}`}
        >
          <RatingSummary rating={rating} />
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              [data.products.length, 'สินค้า'],
              [baht(store.soldTotal), 'ขายแล้ว (ชิ้น)'],
              [rating.count ? rating.avg.toFixed(1) : '-', 'คะแนนร้าน'],
            ].map(([n, label]) => (
              <div key={label} className="bg-slate-50 rounded-xl py-2">
                <p className="text-sm font-black text-slate-900">{n}</p>
                <p className="text-[10px] text-slate-500">{label}</p>
              </div>
            ))}
          </div>
          {store.description && <p className="text-xs text-slate-600 text-wrap-safe">{store.description}</p>}
        </StoreHero>

        <div className="flex border-b border-cyan-300 text-sm font-semibold" role="tablist">
          {[
            ['products', 'สินค้า', data.products.length],
            ['reviews', 'รีวิวร้านค้า', rating.count],
          ].map(([key, label, n]) => (
            <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`flex-1 pb-2 ${tab === key ? 'border-b-2 border-slate-800 text-slate-900' : 'text-slate-400'}`}>
              {label} <span className="text-xs font-normal">({n})</span>
            </button>
          ))}
        </div>

        {tab === 'products' ? (
          <section className="space-y-3">
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSort(s.key)}
                  aria-pressed={sort === s.key}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                    sort === s.key ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {products.length === 0 ? (
              <p className="text-center text-xs text-slate-500 py-8">ร้านนี้ยังไม่มีสินค้า</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {products.map((p) => (
                  <ProductCard key={p._id} product={p} showStore={false} />
                ))}
              </div>
            )}
          </section>
        ) : (
          <div className="bg-white rounded-3xl p-4 shadow-sm">
            <ReviewSection endpoint={`/reviews/seller/${id}`} title="รีวิวร้านค้า" emptyText="ยังไม่มีรีวิวร้านค้านี้" />
          </div>
        )}
      </div>
    </div>
  );
}
