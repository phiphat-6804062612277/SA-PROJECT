'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Search, Ban, ShieldCheck, Trash2, Store, Users, Package, ExternalLink, Scale, ChevronRight } from 'lucide-react';
import API, { errorMessage } from '@/lib/api';
import { baht } from '@/lib/auth';
import { useAuth } from '@/lib/useAuth';
import PageHeader from '@/components/PageHeader';
import Loading from '@/components/Loading';
import Notice from '@/components/Notice';
import ProductImage from '@/components/ProductImage';
import Avatar from '@/components/Avatar';
import ReasonDialog from '@/components/ReasonDialog';
import { useToast } from '@/components/Toast';

const TABS = [
  { key: 'users', label: 'ผู้ใช้', icon: Users },
  { key: 'stores', label: 'ร้านค้า', icon: Store },
  { key: 'products', label: 'สินค้า', icon: Package },
];

const Badge = ({ tone = 'slate', children }) => {
  const tones = {
    slate: 'bg-slate-100 text-slate-600',
    cyan: 'bg-cyan-100 text-cyan-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-600',
  };
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tones[tone]}`}>{children}</span>;
};

const Stat = ({ label, value, tone }) => (
  <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
    <p className={`text-xl font-black ${tone || 'text-slate-900'}`}>{value}</p>
    <p className="text-[10px] text-slate-500">{label}</p>
  </div>
);

// แดชบอร์ดผู้ดูแลระบบ: ลบสินค้า / แบนผู้ซื้อ-ผู้ขาย / แบนร้านค้า
export default function AdminPage() {
  const { user } = useAuth({ roles: ['admin'] });
  const toast = useToast();
  const [tab, setTab] = useState('users');
  const [stats, setStats] = useState(null);
  // เก็บชนิดข้อมูลควบคู่กับรายการ กันเรนเดอร์รายการผู้ใช้ด้วยเลย์เอาต์สินค้า (ทำให้ key เป็น undefined) ตอนสลับแท็บ
  const [loaded, setLoaded] = useState({ kind: '', list: null });
  const loadSeq = useRef(0);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState(null); // { kind: 'user' | 'store', target }
  const [busy, setBusy] = useState(false);

  const kind = tab; // 'users' | 'stores' | 'products'
  const rows = loaded.kind === kind ? loaded.list : null;

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setError('');
    try {
      const params = { q: query || undefined };
      if (tab === 'users' && roleFilter) params.role = roleFilter;
      if (tab === 'stores') params.role = 'seller';
      const url = tab === 'products' ? '/admin/products' : '/admin/users';
      const [list, s] = await Promise.all([API.get(url, { params }), API.get('/admin/stats')]);
      if (seq !== loadSeq.current) return; // มีคำขอใหม่กว่าแล้ว ทิ้งผลเก่า
      setLoaded({ kind: tab, list: Array.isArray(list.data) ? list.data : [] });
      setStats(s.data);
    } catch (err) {
      if (seq !== loadSeq.current) return;
      setLoaded({ kind: tab, list: [] });
      setError(errorMessage(err));
    }
  }, [tab, query, roleFilter]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (!user) return <Loading />;

  const act = async (fn, okText) => {
    setBusy(true);
    try {
      await fn();
      toast.success(okText);
      setDialog(null);
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const unban = (u, kind) => {
    const what = kind === 'store' ? `ร้านค้า "${u.storeName || u.name}"` : `บัญชี ${u.name}`;
    if (!window.confirm(`ปลดระงับ${what}?`)) return;
    act(() => API.put(`/admin/${kind === 'store' ? 'stores' : 'users'}/${u.id}/unban`), `ปลดระงับ${kind === 'store' ? 'ร้านค้า' : 'บัญชี'}แล้ว`);
  };

  const confirmBan = (reason) => {
    const { kind, target } = dialog;
    act(
      () => API.put(`/admin/${kind === 'store' ? 'stores' : 'users'}/${target.id}/ban`, { reason }),
      `ระงับ${kind === 'store' ? 'ร้านค้า' : 'บัญชี'}แล้ว`
    );
  };

  const deleteProduct = (p) => {
    if (!window.confirm(`ลบสินค้า "${p.name}" ออกจากระบบ? (ประวัติออเดอร์เดิมยังอยู่)`)) return;
    act(() => API.delete(`/admin/products/${p._id}`), 'ลบสินค้าแล้ว');
  };

  return (
    <div className="bg-[#dcf0f1] min-h-screen pb-6">
      <PageHeader title="จัดการระบบ (Admin)" right={<ShieldCheck size={20} className="text-slate-700" />} />

      <div className="p-4 space-y-4">
        <Link
          href="/admin/disputes"
          className={`flex items-center gap-3 rounded-2xl p-3 shadow-sm ${stats?.pendingDisputes ? 'bg-amber-50 ring-2 ring-amber-300' : 'bg-white'}`}
        >
          <span className="w-10 h-10 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
            <Scale size={20} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-bold text-slate-900">จัดการข้อพิพาท (Dispute)</span>
            <span className="block text-[11px] text-slate-500">
              {stats ? (stats.pendingDisputes ? `รอพิจารณา ${stats.pendingDisputes} รายการ — เงินถูก Freeze ไว้ใน Escrow` : 'ไม่มีข้อพิพาทที่รอพิจารณา') : 'ไกล่เกลี่ยข้อพิพาทระหว่างผู้ซื้อและผู้ขาย'}
            </span>
          </span>
          {stats?.pendingDisputes > 0 && (
            <span className="bg-amber-500 text-white text-xs font-black rounded-full min-w-6 h-6 px-2 flex items-center justify-center">{stats.pendingDisputes}</span>
          )}
          <ChevronRight size={18} className="text-slate-300 shrink-0" />
        </Link>

        {stats && (
          <div className="grid grid-cols-4 gap-2">
            <Stat label="ผู้ใช้" value={stats.users} />
            <Stat label="ผู้ขาย" value={stats.sellers} />
            <Stat label="สินค้า" value={stats.products} />
            <Stat label="ออเดอร์" value={stats.orders} />
            <div className="col-span-2"><Stat label="บัญชีที่ถูกระงับ" value={stats.bannedUsers} tone={stats.bannedUsers ? 'text-red-500' : ''} /></div>
            <div className="col-span-2"><Stat label="ร้านที่ถูกระงับ" value={stats.bannedStores} tone={stats.bannedStores ? 'text-red-500' : ''} /></div>
          </div>
        )}

        <div className="flex border-b border-cyan-300 text-sm font-semibold" role="tablist">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => {
                setTab(key);
                setRoleFilter('');
              }}
              className={`flex-1 pb-2 flex items-center justify-center gap-1 ${tab === key ? 'border-b-2 border-slate-800 text-slate-900' : 'text-slate-400'}`}
            >
              <Icon size={15} /> {label}
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
            aria-label="ค้นหา"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tab === 'products' ? 'ค้นหาชื่อสินค้า...' : 'ค้นหาชื่อ / อีเมล / ชื่อร้าน...'}
            className="w-full bg-white border border-slate-300 rounded-full py-2 pl-4 pr-10 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
          />
          <button type="submit" aria-label="ค้นหา" className="absolute right-3 top-2.5 text-slate-400">
            <Search className="w-4 h-4" />
          </button>
        </form>

        {tab === 'users' && (
          <div className="flex gap-2">
            {[['', 'ทั้งหมด'], ['buyer', 'ผู้ซื้อ'], ['seller', 'ผู้ขาย']].map(([v, l]) => (
              <button
                key={v}
                onClick={() => setRoleFilter(v)}
                aria-pressed={roleFilter === v}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border ${roleFilter === v ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'}`}
              >
                {l}
              </button>
            ))}
          </div>
        )}

        <Notice type="error">{error}</Notice>

        {rows === null ? (
          <Loading />
        ) : rows.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-10">ไม่พบข้อมูล</p>
        ) : tab === 'products' ? (
          <div className="space-y-3">
            {rows.map((p) => (
              <div key={p._id || p.id} className="bg-white p-3 rounded-2xl shadow-sm flex gap-3 items-center">
                <ProductImage src={p.imageUrl} alt={p.name} className="w-14 h-14 rounded-lg shrink-0" iconSize={20} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 line-clamp-2 text-wrap-safe">{p.name}</p>
                  <p className="text-[11px] text-slate-500 truncate">
                    ฿ {baht(p.price)} · สต็อก {p.stock} · ร้าน {p.seller?.storeName || p.seller?.name || '-'}
                  </p>
                  <div className="flex gap-1 mt-1">
                    {p.inStore === false && <Badge>นอกร้าน</Badge>}
                    {p.suspended && <Badge tone="red">ถูกระงับ</Badge>}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Link href={`/product/${p._id}`} aria-label={`เปิดหน้าสินค้า ${p.name}`} className="p-2 bg-slate-100 rounded-full text-slate-600 hover:bg-slate-200">
                    <ExternalLink size={14} />
                  </Link>
                  <button disabled={busy} onClick={() => deleteProduct(p)} aria-label={`ลบ ${p.name}`} className="p-2 bg-red-50 rounded-full text-red-500 hover:bg-red-100 disabled:opacity-40">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : tab === 'stores' ? (
          <div className="space-y-3">
            {rows.map((u) => (
              <div key={u.id} className="bg-white p-3 rounded-2xl shadow-sm space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar src={u.storeLogoUrl} name={u.storeName || u.name} size={36} />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 text-wrap-safe">{u.storeName || u.name}</p>
                      <p className="text-[11px] text-slate-500 truncate">เจ้าของ: {u.name} · {u.email}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {u.storeBanned ? <Badge tone="red">ร้านถูกระงับ</Badge> : <Badge tone="cyan">ปกติ</Badge>}
                    {u.isBanned && <Badge tone="red">บัญชีถูกแบน</Badge>}
                  </div>
                </div>
                {u.storeBanned && u.storeBanReason && <p className="text-[11px] text-red-500 text-wrap-safe">เหตุผล: {u.storeBanReason}</p>}
                <div className="flex gap-2">
                  {!u.storeBanned && !u.isBanned && (
                    <Link href={`/store/${u.id}`} className="flex-1 text-center bg-slate-100 text-slate-700 font-bold py-1.5 rounded-full text-xs">ดูหน้าร้าน</Link>
                  )}
                  {u.storeBanned ? (
                    <button disabled={busy} onClick={() => unban(u, 'store')} className="flex-1 bg-emerald-500 text-white font-bold py-1.5 rounded-full text-xs disabled:opacity-40">ปลดระงับร้าน</button>
                  ) : (
                    <button disabled={busy} onClick={() => setDialog({ kind: 'store', target: u })} className="flex-1 bg-red-50 text-red-600 border border-red-200 font-bold py-1.5 rounded-full text-xs disabled:opacity-40">แบนร้านค้า</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((u) => (
              <div key={u.id} className="bg-white p-3 rounded-2xl shadow-sm space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar src={u.avatarUrl} name={u.name} size={36} />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{u.name}</p>
                      <p className="text-[11px] text-slate-500 truncate">{u.email}</p>
                      {u.role === 'seller' && u.storeName && <p className="text-[11px] text-slate-500 truncate">ร้าน {u.storeName}</p>}
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1 shrink-0">
                    <Badge tone={u.role === 'seller' ? 'amber' : 'cyan'}>{u.role === 'seller' ? 'ผู้ขาย' : 'ผู้ซื้อ'}</Badge>
                    {u.isBanned && <Badge tone="red">ถูกแบน</Badge>}
                    {u.storeBanned && <Badge tone="red">ร้านถูกระงับ</Badge>}
                  </div>
                </div>
                {u.isBanned && u.banReason && <p className="text-[11px] text-red-500 text-wrap-safe">เหตุผล: {u.banReason}</p>}
                <div className="flex gap-2">
                  {u.isBanned ? (
                    <button disabled={busy} onClick={() => unban(u, 'user')} className="flex-1 bg-emerald-500 text-white font-bold py-1.5 rounded-full text-xs disabled:opacity-40">ปลดแบนบัญชี</button>
                  ) : (
                    <button disabled={busy} onClick={() => setDialog({ kind: 'user', target: u })} className="flex-1 inline-flex items-center justify-center gap-1 bg-red-50 text-red-600 border border-red-200 font-bold py-1.5 rounded-full text-xs disabled:opacity-40">
                      <Ban size={12} /> แบน{u.role === 'seller' ? 'ผู้ขาย' : 'ผู้ซื้อ'}
                    </button>
                  )}
                  {u.role === 'seller' &&
                    (u.storeBanned ? (
                      <button disabled={busy} onClick={() => unban(u, 'store')} className="flex-1 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold py-1.5 rounded-full text-xs disabled:opacity-40">ปลดระงับร้าน</button>
                    ) : (
                      <button disabled={busy} onClick={() => setDialog({ kind: 'store', target: u })} className="flex-1 bg-white text-slate-700 border border-slate-300 font-bold py-1.5 rounded-full text-xs disabled:opacity-40">แบนร้านค้า</button>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {dialog && (
        <ReasonDialog
          title={dialog.kind === 'store' ? `แบนร้านค้า "${dialog.target.storeName || dialog.target.name}"` : `แบนบัญชี ${dialog.target.name}`}
          description={
            dialog.kind === 'store'
              ? 'สินค้าทั้งหมดของร้านจะถูกซ่อน และผู้ขายลงขายสินค้าเพิ่มไม่ได้ (บัญชียังล็อกอิน จัดส่งออเดอร์เดิม และถอนเงินได้)'
              : 'บัญชีนี้จะเข้าสู่ระบบไม่ได้ทันที และหากเป็นผู้ขาย สินค้าทั้งหมดจะถูกซ่อน'
          }
          confirmLabel={dialog.kind === 'store' ? 'แบนร้านค้า' : 'แบนบัญชี'}
          busy={busy}
          onConfirm={confirmBan}
          onCancel={() => setDialog(null)}
        />
      )}
    </div>
  );
}
