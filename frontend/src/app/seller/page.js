'use client';
import { Suspense, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Settings, Wallet, Clock, Truck, ShieldCheck, Search, ExternalLink, Ban, Scale, MessageCircle } from 'lucide-react';
import API, { errorMessage } from '@/lib/api';
import { baht, updateStoredUser } from '@/lib/auth';
import { useAuth } from '@/lib/useAuth';
import PageHeader from '@/components/PageHeader';
import Avatar from '@/components/Avatar';
import Loading from '@/components/Loading';
import Notice from '@/components/Notice';
import { RatingSummary } from '@/components/StarRating';
import SellerOrderCard from '@/components/seller/SellerOrderCard';
import SellerProductRow, { LOW_STOCK } from '@/components/seller/SellerProductRow';

const ORDER_FILTERS = [
  { key: 'todo', label: 'ต้องจัดส่ง', test: (o) => o.status === 'PENDING_SHIPMENT' },
  { key: 'shipped', label: 'จัดส่งแล้ว', test: (o) => o.status === 'SHIPPED' },
  { key: 'disputed', label: 'ข้อพิพาท', test: (o) => o.status === 'DISPUTED' },
  { key: 'done', label: 'สำเร็จ', test: (o) => o.status === 'COMPLETED' },
  { key: 'cancelled', label: 'ยกเลิก/คืนเงิน', test: (o) => o.status === 'CANCELLED' || o.status === 'REFUNDED' },
  { key: 'all', label: 'ทั้งหมด', test: () => true },
];

const PRODUCT_FILTERS = [
  { key: 'all', label: 'ทั้งหมด', test: () => true },
  { key: 'store', label: 'ในร้าน', test: (p) => p.inStore !== false },
  { key: 'outside', label: 'นอกร้าน', test: (p) => p.inStore === false },
  { key: 'low', label: 'สต็อกต่ำ', test: (p) => p.stock <= LOW_STOCK },
];

const Chip = ({ active, onClick, children, count }) => (
  <button
    onClick={onClick}
    aria-pressed={active}
    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition ${
      active ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
    }`}
  >
    {children}
    {count !== undefined && <span className={`ml-1 ${active ? 'text-cyan-200' : 'text-slate-400'}`}>{count}</span>}
  </button>
);

function SellerDashboard() {
  const { user } = useAuth({ roles: ['seller'] });
  const params = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = useState(params.get('tab') === 'products' ? 'products' : 'orders');
  const [orders, setOrders] = useState(null);
  const [products, setProducts] = useState(null);
  const [me, setMe] = useState(null);
  const [balance, setBalance] = useState(0);
  const [rating, setRating] = useState({ avg: 0, count: 0 });
  const [orderFilter, setOrderFilter] = useState(null); // null = เลือกอัตโนมัติหลังโหลด
  const [productFilter, setProductFilter] = useState('all');
  const [productSearch, setProductSearch] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [o, p, profile, wallet, received] = await Promise.all([
        API.get('/orders/selling'),
        API.get('/products/mine'),
        API.get('/auth/me'),
        API.get('/wallet'),
        API.get('/reviews/received'),
      ]);
      setOrders(o.data);
      setProducts(p.data);
      setMe(profile.data);
      updateStoredUser(profile.data);
      setBalance(wallet.data.balance ?? 0);
      setRating(received.data.rating);
    } catch (err) {
      setOrders((prev) => prev || []);
      setProducts((prev) => prev || []);
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  // ลิงก์จากการแจ้งเตือน (/seller?tab=orders&filter=todo) — ทำงานแม้อยู่หน้านี้อยู่แล้ว (param เปลี่ยนแต่ component ไม่ถูกสร้างใหม่)
  const qTab = params.get('tab');
  const qFilter = params.get('filter');
  useEffect(() => {
    if (qTab === 'products' || qTab === 'orders') setTab(qTab);
    if (qFilter && ORDER_FILTERS.some((f) => f.key === qFilter)) {
      setTab('orders');
      setOrderFilter(qFilter);
    }
  }, [qTab, qFilter]);

  if (!user || orders === null || products === null) return <Loading />;

  const count = (list, key, filters) => list.filter(filters.find((f) => f.key === key).test).length;
  const todo = count(orders, 'todo', ORDER_FILTERS);
  const shipped = count(orders, 'shipped', ORDER_FILTERS);
  const disputed = count(orders, 'disputed', ORDER_FILTERS);
  const frozen = orders.filter((o) => o.status === 'DISPUTED').reduce((s, o) => s + o.totalAmount, 0);
  const held = orders.filter((o) => o.escrowStatus === 'HELD').reduce((s, o) => s + o.totalAmount, 0);

  const activeOrderFilter = orderFilter || (todo > 0 ? 'todo' : 'all');
  const shownOrders = orders.filter(ORDER_FILTERS.find((f) => f.key === activeOrderFilter).test);

  const kw = productSearch.trim().toLowerCase();
  const shownProducts = products
    .filter(PRODUCT_FILTERS.find((f) => f.key === productFilter).test)
    .filter((p) => !kw || p.name.toLowerCase().includes(kw));

  const storeName = me?.storeName || me?.name || user.name;

  // เปลี่ยนแท็บ/ตัวกรองแล้วอัปเดต URL ตาม — ทำให้ลิงก์จากการแจ้งเตือน (/seller?tab=orders&filter=todo) ใช้ได้เสมอ แม้เคยกดเปลี่ยนตัวกรองเองมาก่อน
  const pick = (nextTab, filter) => {
    setTab(nextTab);
    if (filter) setOrderFilter(filter);
    router.replace(filter ? `/seller?tab=${nextTab}&filter=${filter}` : `/seller?tab=${nextTab}`, { scroll: false });
  };
  const goOrders = (key) => pick('orders', key);

  return (
    <div className="bg-[#dcf0f1] min-h-screen pb-6">
      <PageHeader
        title="แดชบอร์ดร้านค้า"
        right={
          <Link href="/seller/store" aria-label="ตั้งค่าร้านค้า" className="text-slate-700">
            <Settings size={20} />
          </Link>
        }
      />

      <div className="p-4 space-y-4">
        <Notice type="error">{error}</Notice>

        {me?.storeBanned && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-2xl p-3 text-xs font-semibold flex gap-2" role="alert">
            <Ban size={16} className="shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <p>ร้านค้าของคุณถูกระงับโดยผู้ดูแลระบบ สินค้าถูกซ่อนและไม่สามารถลงขายเพิ่มได้ (ยังจัดส่งออเดอร์เดิมและถอนเงินได้)</p>
              {me.storeBanReason && <p className="font-normal">เหตุผล: {me.storeBanReason}</p>}
              <Link href="/chat/new?support=1" className="inline-flex items-center gap-1 bg-red-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-full">
                <MessageCircle size={12} /> ติดต่อ Admin / ยื่นอุทธรณ์
              </Link>
            </div>
          </div>
        )}

        {/* ข้อมูลร้าน */}
        <div className="bg-white rounded-3xl p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <Avatar src={me?.storeLogoUrl} name={storeName} size={48} />
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-400">ร้านค้าของคุณ</p>
                <h2 className="font-bold text-slate-900 text-base text-wrap-safe">{storeName}</h2>
                <RatingSummary rating={rating} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              <Link href={`/store/${user.id}`} className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-700">
                ดูหน้าร้าน <ExternalLink size={12} />
              </Link>
              <Link href="/seller/store" className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600">
                ตั้งค่าร้าน <Settings size={12} />
              </Link>
            </div>
          </div>
        </div>

        {disputed > 0 && (
          <button
            onClick={() => goOrders('disputed')}
            className="w-full text-left bg-red-50 border border-red-200 rounded-2xl p-3 flex items-start gap-2"
          >
            <Scale size={18} className="text-red-500 shrink-0 mt-0.5" />
            <span className="text-xs text-red-700">
              <b>มี {disputed} ออเดอร์ที่ถูกเปิดข้อพิพาท</b> — เงิน <b className="money">฿ {baht(frozen)}</b> ถูก Freeze รอ Admin ตัดสิน
              กดเพื่อดูและชี้แจง
            </span>
          </button>
        )}

        {/* ตัวเลขสำคัญ */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => goOrders('todo')} className={`text-left rounded-2xl p-3 shadow-sm ${todo > 0 ? 'bg-amber-50 ring-2 ring-amber-300' : 'bg-white'}`}>
            <Clock size={18} className="text-amber-500" />
            <p className="text-2xl font-black text-slate-900 mt-1">{todo}</p>
            <p className="text-[11px] text-slate-500">ออเดอร์ที่ต้องจัดส่ง</p>
          </button>
          <button onClick={() => goOrders('shipped')} className="text-left bg-white rounded-2xl p-3 shadow-sm">
            <Truck size={18} className="text-sky-500" />
            <p className="text-2xl font-black text-slate-900 mt-1">{shipped}</p>
            <p className="text-[11px] text-slate-500">จัดส่งแล้ว (รอผู้ซื้อยืนยัน หรือครบกำหนดปล่อยอัตโนมัติ)</p>
          </button>
          <div className="bg-white rounded-2xl p-3 shadow-sm">
            <ShieldCheck size={18} className="text-violet-500" />
            <p className="text-xl font-black text-slate-900 mt-1 money">฿ {baht(held)}</p>
            <p className="text-[11px] text-slate-500">เงินที่ Escrow ถือไว้</p>
          </div>
          <Link href="/wallet" className="bg-white rounded-2xl p-3 shadow-sm block">
            <Wallet size={18} className="text-emerald-500" />
            <p className="text-xl font-black text-slate-900 mt-1 money">฿ {baht(balance)}</p>
            <p className="text-[11px] text-slate-500">ยอดใน Wallet (ถอนได้)</p>
          </Link>
        </div>

        {/* ทางลัด */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/seller/products/new" className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 rounded-full text-sm">
            <Plus size={16} /> ลงขายสินค้า
          </Link>
          <Link href="/wallet/withdraw" className="flex items-center justify-center gap-1.5 bg-white border border-slate-300 text-slate-800 font-bold py-2.5 rounded-full text-sm hover:bg-slate-50">
            <Wallet size={16} /> ถอนเงิน
          </Link>
        </div>

        {/* แท็บ */}
        <div className="flex border-b border-cyan-300 text-sm font-semibold" role="tablist">
          {[
            ['orders', 'ออเดอร์', orders.length],
            ['products', 'สินค้า', products.length],
          ].map(([key, label, n]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => pick(key, key === 'orders' ? activeOrderFilter : null)}
              className={`flex-1 pb-2 ${tab === key ? 'border-b-2 border-slate-800 text-slate-900' : 'text-slate-400'}`}
            >
              {label} <span className="text-xs font-normal">({n})</span>
            </button>
          ))}
        </div>

        {tab === 'orders' ? (
          <div className="space-y-3">
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {ORDER_FILTERS.map((f) => (
                <Chip key={f.key} active={activeOrderFilter === f.key} onClick={() => pick('orders', f.key)} count={count(orders, f.key, ORDER_FILTERS)}>
                  {f.label}
                </Chip>
              ))}
            </div>

            {shownOrders.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-10">
                {orders.length === 0 ? 'ยังไม่มีออเดอร์เข้ามา' : 'ไม่มีออเดอร์ในหมวดนี้'}
              </p>
            ) : (
              shownOrders.map((o) => <SellerOrderCard key={o._id} order={o} onChanged={load} />)
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <input
                type="search"
                aria-label="ค้นหาสินค้าในร้าน"
                placeholder="ค้นหาสินค้าในร้าน..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-full py-2 pl-4 pr-10 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              />
              <Search className="absolute right-3 top-2.5 text-slate-400 w-4 h-4" />
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {PRODUCT_FILTERS.map((f) => (
                <Chip key={f.key} active={productFilter === f.key} onClick={() => setProductFilter(f.key)} count={count(products, f.key, PRODUCT_FILTERS)}>
                  {f.label}
                </Chip>
              ))}
            </div>

            {shownProducts.length === 0 ? (
              <div className="text-center py-10 space-y-3">
                <p className="text-sm text-slate-400">{products.length === 0 ? 'ยังไม่มีสินค้าในร้าน' : 'ไม่พบสินค้าที่ตรงเงื่อนไข'}</p>
                {products.length === 0 && (
                  <Link href="/seller/products/new" className="inline-block bg-[#9bdadd] text-slate-900 font-bold px-5 py-2 rounded-full text-xs">
                    ลงขายสินค้าชิ้นแรก
                  </Link>
                )}
              </div>
            ) : (
              shownProducts.map((p) => <SellerProductRow key={p._id} product={p} onChanged={load} />)
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SellerPage() {
  return (
    <Suspense fallback={<Loading />}>
      <SellerDashboard />
    </Suspense>
  );
}
