'use client';
import { Suspense, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Scale } from 'lucide-react';
import API, { errorMessage } from '@/lib/api';
import { baht } from '@/lib/auth';
import { useAuth } from '@/lib/useAuth';
import PageHeader from '@/components/PageHeader';
import Loading from '@/components/Loading';
import Notice from '@/components/Notice';
import SellerOrderCard from '@/components/seller/SellerOrderCard';
import { Chip, ORDER_FILTERS, countBy } from '@/components/seller/SellerParts';

// ออเดอร์ของร้าน (เมนู "ออเดอร์"): กรองตามสถานะ / กรอกเลขพัสดุ / ปฏิเสธออเดอร์ / ชี้แจงข้อพิพาท
//   ?filter=todo|shipped|disputed|done|cancelled|all — ลิงก์จากการแจ้งเตือนพามาที่ตัวกรองนี้เลย
function SellerOrders() {
  const { user } = useAuth({ roles: ['seller'] });
  const params = useSearchParams();
  const router = useRouter();
  const [orders, setOrders] = useState(null);
  const initial = params.get('filter');
  const [orderFilter, setOrderFilter] = useState(ORDER_FILTERS.some((f) => f.key === initial) ? initial : null); // null = เลือกอัตโนมัติหลังโหลด
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setOrders((await API.get('/orders/selling')).data);
      setError('');
    } catch (err) {
      setOrders((prev) => prev || []);
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  // ลิงก์จากการแจ้งเตือน (/seller/orders?filter=todo) — ทำงานแม้อยู่หน้านี้อยู่แล้ว (param เปลี่ยนแต่ component ไม่ถูกสร้างใหม่)
  const qFilter = params.get('filter');
  useEffect(() => {
    if (qFilter && ORDER_FILTERS.some((f) => f.key === qFilter)) setOrderFilter(qFilter);
  }, [qFilter]);

  if (!user || orders === null) return <Loading />;

  const todo = countBy(orders, 'todo', ORDER_FILTERS);
  const disputed = countBy(orders, 'disputed', ORDER_FILTERS);
  const frozen = orders.filter((o) => o.status === 'DISPUTED').reduce((s, o) => s + o.totalAmount, 0);
  const active = orderFilter || (todo > 0 ? 'todo' : 'all');
  const shown = orders.filter(ORDER_FILTERS.find((f) => f.key === active).test);

  const pick = (key) => {
    setOrderFilter(key);
    router.replace(`/seller/orders?filter=${key}`, { scroll: false });
  };

  return (
    <div className="bg-[#dcf0f1] min-h-screen pb-6">
      <PageHeader title="ออเดอร์ของร้าน" />
      <div className="p-4 space-y-4">
        <Notice type="error">{error}</Notice>

        {todo > 0 && active !== 'todo' && (
          <button onClick={() => pick('todo')} className="w-full text-left bg-amber-50 ring-2 ring-amber-300 rounded-2xl p-3 text-xs text-amber-900">
            <b>มี {todo} ออเดอร์ที่ต้องจัดส่ง</b> — กดเพื่อไปกรอกเลขพัสดุ
          </button>
        )}
        {disputed > 0 && (
          <button onClick={() => pick('disputed')} className="w-full text-left bg-red-50 border border-red-200 rounded-2xl p-3 flex items-start gap-2">
            <Scale size={18} className="text-red-500 shrink-0 mt-0.5" />
            <span className="text-xs text-red-700">
              <b>มี {disputed} ออเดอร์ที่ถูกเปิดข้อพิพาท</b> — เงิน <b className="money">฿ {baht(frozen)}</b> ถูก Freeze รอ Admin ตัดสิน กดเพื่อดูและชี้แจง
            </span>
          </button>
        )}

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {ORDER_FILTERS.map((f) => (
            <Chip key={f.key} active={active === f.key} onClick={() => pick(f.key)} count={countBy(orders, f.key, ORDER_FILTERS)}>
              {f.label}
            </Chip>
          ))}
        </div>

        {shown.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-10">{orders.length === 0 ? 'ยังไม่มีออเดอร์เข้ามา' : 'ไม่มีออเดอร์ในหมวดนี้'}</p>
        ) : (
          shown.map((o) => <SellerOrderCard key={o._id} order={o} onChanged={load} />)
        )}

        <Link href="/seller" className="block text-center text-xs font-bold text-cyan-700 underline pt-2">
          ไปที่แดชบอร์ดร้านค้า
        </Link>
      </div>
    </div>
  );
}

export default function SellerOrdersPage() {
  return (
    <Suspense fallback={<Loading />}>
      <SellerOrders />
    </Suspense>
  );
}
