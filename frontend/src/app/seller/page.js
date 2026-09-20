'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Settings, Wallet, Clock, Truck, ShieldCheck, ExternalLink, Ban, Scale, MessageCircle, Package, ChevronRight, TriangleAlert } from 'lucide-react';
import API, { errorMessage } from '@/lib/api';
import { baht, updateStoredUser } from '@/lib/auth';
import { useAuth } from '@/lib/useAuth';
import PageHeader from '@/components/PageHeader';
import Avatar from '@/components/Avatar';
import Loading from '@/components/Loading';
import Notice from '@/components/Notice';
import { RatingSummary } from '@/components/StarRating';
import { LOW_STOCK } from '@/components/seller/SellerProductRow';

const Tile = ({ href, icon: Icon, tone, value, label, highlight, money }) => {
  const body = (
    <>
      <Icon size={18} className={tone} />
      <p className={`${money ? 'text-xl money' : 'text-2xl'} font-black text-slate-900 mt-1`}>{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </>
  );
  const cls = `block text-left rounded-2xl p-3 shadow-sm ${highlight ? 'bg-amber-50 ring-2 ring-amber-300' : 'bg-white'}`;
  return href ? (
    <Link href={href} className={cls}>{body}</Link>
  ) : (
    <div className={cls}>{body}</div>
  );
};

const Shortcut = ({ href, icon: Icon, title, hint }) => (
  <Link href={href} className="flex items-center gap-3 p-3.5 hover:bg-slate-50">
    <span className="w-9 h-9 rounded-full bg-cyan-50 text-cyan-700 flex items-center justify-center shrink-0">
      <Icon size={18} />
    </span>
    <span className="flex-1 min-w-0">
      <span className="block text-xs font-bold text-slate-800">{title}</span>
      {hint && <span className="block text-[11px] text-slate-500 truncate">{hint}</span>}
    </span>
    <ChevronRight size={16} className="text-slate-300 shrink-0" />
  </Link>
);

// แดชบอร์ดร้านค้า (เมนู "แดชบอร์ด"): ภาพรวมร้าน / Wallet-ถอนเงิน / ตั้งค่าร้าน — ส่วนออเดอร์และสินค้าแยกไปเมนูของตัวเอง
export default function SellerDashboardPage() {
  const { user } = useAuth({ roles: ['seller'] });
  const [orders, setOrders] = useState(null);
  const [products, setProducts] = useState(null);
  const [me, setMe] = useState(null);
  const [balance, setBalance] = useState(0);
  const [rating, setRating] = useState({ avg: 0, count: 0 });
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
      setError('');
    } catch (err) {
      setOrders((prev) => prev || []);
      setProducts((prev) => prev || []);
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (!user || orders === null || products === null) return <Loading />;

  const todo = orders.filter((o) => o.status === 'PENDING_SHIPMENT').length;
  const shipped = orders.filter((o) => o.status === 'SHIPPED').length;
  const disputedOrders = orders.filter((o) => o.status === 'DISPUTED');
  const frozen = disputedOrders.reduce((s, o) => s + o.totalAmount, 0);
  const held = orders.filter((o) => o.escrowStatus === 'HELD').reduce((s, o) => s + o.totalAmount, 0);
  const lowStock = products.filter((p) => p.stock <= LOW_STOCK).length;
  const storeName = me?.storeName || me?.name || user.name;

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
              <Avatar src={me?.storeLogoUrl} name={storeName} size={52} />
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-400">ร้านค้าของคุณ</p>
                <h2 className="font-bold text-slate-900 text-base text-wrap-safe">{storeName}</h2>
                <RatingSummary rating={rating} />
              </div>
            </div>
            <Link href={`/store/${user.id}`} className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-cyan-700">
              ดูหน้าร้าน <ExternalLink size={12} />
            </Link>
          </div>
        </div>

        {disputedOrders.length > 0 && (
          <Link href="/seller/orders?filter=disputed" className="w-full text-left bg-red-50 border border-red-200 rounded-2xl p-3 flex items-start gap-2">
            <Scale size={18} className="text-red-500 shrink-0 mt-0.5" />
            <span className="text-xs text-red-700">
              <b>มี {disputedOrders.length} ออเดอร์ที่ถูกเปิดข้อพิพาท</b> — เงิน <b className="money">฿ {baht(frozen)}</b> ถูก Freeze รอ Admin ตัดสิน กดเพื่อดูและชี้แจง
            </span>
          </Link>
        )}

        {/* ตัวเลขสำคัญ */}
        <div className="grid grid-cols-2 gap-3">
          <Tile href="/seller/orders?filter=todo" icon={Clock} tone="text-amber-500" value={todo} label="ออเดอร์ที่ต้องจัดส่ง" highlight={todo > 0} />
          <Tile href="/seller/orders?filter=shipped" icon={Truck} tone="text-sky-500" value={shipped} label="จัดส่งแล้ว (รอผู้ซื้อยืนยัน)" />
          <Tile icon={ShieldCheck} tone="text-violet-500" value={`฿ ${baht(held)}`} label="เงินที่ Escrow ถือไว้" money />
          <Tile href="/wallet" icon={Wallet} tone="text-emerald-500" value={`฿ ${baht(balance)}`} label="ยอดใน Wallet (ถอนได้)" money />
        </div>

        {lowStock > 0 && (
          <Link href="/seller/products?filter=low" className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-900">
            <TriangleAlert size={16} className="shrink-0" />
            <span className="flex-1"><b>{lowStock} สินค้า</b> สต็อกเหลือน้อย (≤ {LOW_STOCK} ชิ้น) — กดเพื่อดูและเติมสต็อก</span>
            <ChevronRight size={16} className="shrink-0" />
          </Link>
        )}

        {/* ทางลัด */}
        <div className="bg-white rounded-2xl shadow-sm divide-y">
          <Shortcut href="/seller/products/new" icon={Plus} title="ลงขายสินค้าใหม่" hint="เพิ่มสินค้าเข้าร้านหรือตลาดรวม" />
          <Shortcut href="/seller/products" icon={Package} title="จัดการสินค้า" hint={`${products.length} รายการในร้าน`} />
          <Shortcut href="/wallet/withdraw" icon={Wallet} title="ถอนเงิน" hint={`ยอดที่ถอนได้ ฿ ${baht(balance)}`} />
          <Shortcut href="/seller/store" icon={Settings} title="ตั้งค่าร้านค้า" hint="ชื่อร้าน คำอธิบาย โลโก้ และแบนเนอร์" />
          <Shortcut href="/profile" icon={ShieldCheck} title="โปรไฟล์และรูปโปรไฟล์" hint="ข้อมูลติดต่อ ที่อยู่ ออกจากระบบ" />
        </div>
      </div>
    </div>
  );
}
