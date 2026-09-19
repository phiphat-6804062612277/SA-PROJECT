'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Search, Scale, ChevronRight } from 'lucide-react';
import API, { errorMessage } from '@/lib/api';
import { baht } from '@/lib/auth';
import { useAuth } from '@/lib/useAuth';
import PageHeader from '@/components/PageHeader';
import Loading from '@/components/Loading';
import Notice from '@/components/Notice';
import { DisputeBadge } from '@/components/DisputeView';

const FILTERS = [
  ['PENDING', 'รอพิจารณา'],
  ['RESOLVED', 'ตัดสินแล้ว'],
  ['ALL', 'ทั้งหมด'],
];

// Dispute Resolution Panel: รายการข้อพิพาททั้งหมด กรองสถานะ/ค้นหาได้ (เฉพาะ Admin)
export default function AdminDisputesPage() {
  const { user } = useAuth({ roles: ['admin'] });
  const [status, setStatus] = useState('PENDING');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [loaded, setLoaded] = useState({ key: '', list: null });
  const [error, setError] = useState('');
  const seq = useRef(0);

  const key = `${status}|${query}`;
  const rows = loaded.key === key ? loaded.list : null;

  const load = useCallback(async () => {
    const my = ++seq.current;
    setError('');
    try {
      const res = await API.get('/admin/disputes', { params: { status, q: query || undefined } });
      if (my === seq.current) setLoaded({ key: `${status}|${query}`, list: res.data });
    } catch (err) {
      if (my !== seq.current) return;
      setLoaded({ key: `${status}|${query}`, list: [] });
      setError(errorMessage(err));
    }
  }, [status, query]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (!user) return <Loading />;

  return (
    <div className="bg-[#dcf0f1] min-h-screen pb-24">
      <PageHeader title="จัดการข้อพิพาท" back right={<Scale size={20} className="text-slate-700" />} />

      <div className="p-4 space-y-4">
        <div className="flex border-b border-cyan-300 text-sm font-semibold" role="tablist">
          {FILTERS.map(([value, label]) => (
            <button
              key={value}
              role="tab"
              aria-selected={status === value}
              onClick={() => setStatus(value)}
              className={`flex-1 pb-2 ${status === value ? 'border-b-2 border-slate-800 text-slate-900' : 'text-slate-400'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(q.trim());
          }}
          className="relative"
        >
          <input
            type="search"
            aria-label="ค้นหาข้อพิพาท"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาเลขออเดอร์ / ชื่อผู้ซื้อ / ผู้ขาย / ร้าน..."
            className="w-full bg-white border border-slate-300 rounded-full py-2 pl-4 pr-10 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
          />
          <button type="submit" aria-label="ค้นหา" className="absolute right-3 top-2.5 text-slate-400">
            <Search className="w-4 h-4" />
          </button>
        </form>

        <Notice type="error">{error}</Notice>

        {rows === null ? (
          <Loading />
        ) : rows.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-10">
            {status === 'PENDING' && !query ? 'ไม่มีข้อพิพาทที่รอพิจารณา 🎉' : 'ไม่พบข้อพิพาท'}
          </p>
        ) : (
          <div className="space-y-3">
            {rows.map((d) => (
              <Link
                key={d.id}
                href={`/admin/disputes/${d.id}`}
                className={`block bg-white rounded-2xl shadow-sm p-3 space-y-2 hover:shadow-md transition ${d.status === 'PENDING' ? 'ring-2 ring-amber-200' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-slate-800">ออเดอร์ #{String(d.orderId).slice(-6).toUpperCase()}</p>
                  <DisputeBadge status={d.status} />
                </div>
                <p className="text-[11px] text-slate-600 text-wrap-safe">
                  <span className="font-bold text-slate-800">{d.buyer.name}</span> (ผู้ซื้อ) ↔{' '}
                  <span className="font-bold text-slate-800">{d.seller.storeName || d.seller.name}</span> (ผู้ขาย)
                </p>
                <p className="text-[11px] text-slate-500 line-clamp-2 text-wrap-safe">{d.reason}</p>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">
                    เปิดเมื่อ {new Date(d.createdAt).toLocaleDateString('th-TH', { dateStyle: 'medium' })}
                  </span>
                  <span className="flex items-center gap-1 font-black text-red-600">
                    <span className="text-[10px] font-normal text-slate-400">{d.status === 'PENDING' ? 'Freeze' : 'ยอดเงิน'}</span>
                    <span className="money">฿ {baht(d.amount)}</span>
                    <ChevronRight size={14} className="text-slate-300" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
