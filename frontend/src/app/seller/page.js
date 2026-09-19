'use client';
import { Suspense, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import API, { errorMessage } from '@/lib/api';
import { baht } from '@/lib/auth';
import { useAuth } from '@/lib/useAuth';
import ProductImage from '@/components/ProductImage';
import PageHeader from '@/components/PageHeader';
import Loading from '@/components/Loading';
import Notice from '@/components/Notice';
import OrderStatus, { ESCROW_TEXT } from '@/components/OrderStatus';

function SellerDashboard() {
  const { user } = useAuth({ roles: ['seller'] });
  const params = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') === 'products' ? 'products' : 'orders');
  const [orders, setOrders] = useState(null);
  const [products, setProducts] = useState(null);
  const [tracking, setTracking] = useState({}); // { [orderId]: 'เลขพัสดุ' }
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState({ type: 'info', text: '' });

  const load = useCallback(async () => {
    try {
      const [o, p] = await Promise.all([API.get('/orders/selling'), API.get('/products/mine')]);
      setOrders(o.data);
      setProducts(p.data);
    } catch (err) {
      setOrders([]);
      setProducts([]);
      setMessage({ type: 'error', text: errorMessage(err) });
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const run = async (id, fn, okText) => {
    setBusyId(id);
    setMessage({ type: 'info', text: '' });
    try {
      await fn();
      setMessage({ type: 'success', text: okText });
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: errorMessage(err) });
    } finally {
      setBusyId('');
    }
  };

  const ship = (o) =>
    run(o._id, () => API.put(`/orders/${o._id}/ship`, { trackingNumber: tracking[o._id] || '' }), 'บันทึกเลขพัสดุแล้ว สถานะเปลี่ยนเป็นจัดส่งแล้ว');

  const reject = (o) => {
    if (!window.confirm('ยกเลิกคำสั่งซื้อนี้? ระบบจะคืนเงินให้ผู้ซื้อทั้งหมด')) return;
    run(o._id, () => API.put(`/orders/${o._id}/cancel`), 'ยกเลิกคำสั่งซื้อและคืนเงินผู้ซื้อแล้ว');
  };

  const remove = (p) => {
    if (!window.confirm(`ลบสินค้า "${p.name}" ออกจากร้าน?`)) return;
    run(p._id, () => API.delete(`/products/${p._id}`), 'ลบสินค้าเรียบร้อยแล้ว');
  };

  if (!user || orders === null || products === null) return <Loading />;

  const pending = orders.filter((o) => o.status === 'PENDING_SHIPMENT').length;
  const held = orders.filter((o) => o.escrowStatus === 'HELD').reduce((s, o) => s + o.totalAmount, 0);

  return (
    <div className="bg-[#e0f7f7] min-h-screen">
      <PageHeader title={`ร้าน ${user.name}`} />

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="bg-white rounded-2xl p-3 shadow-sm">
            <p className="text-[10px] text-slate-500">รอจัดส่ง</p>
            <p className="text-xl font-black text-slate-900">{pending}</p>
          </div>
          <div className="bg-white rounded-2xl p-3 shadow-sm">
            <p className="text-[10px] text-slate-500">เงินที่ Escrow ถือไว้ (รอผู้ซื้อยืนยัน)</p>
            <p className="text-xl font-black text-slate-900">฿ {baht(held)}</p>
          </div>
        </div>

        <div className="flex justify-center border-b border-cyan-300 text-sm font-semibold" role="tablist">
          {[
            ['orders', `ออเดอร์ (${orders.length})`],
            ['products', `สินค้า (${products.length})`],
          ].map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`pb-2 px-5 ${tab === key ? 'border-b-2 border-slate-800 text-slate-900' : 'text-slate-400'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <Notice type={message.type}>{message.text}</Notice>

        {tab === 'orders' ? (
          orders.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-10">ยังไม่มีออเดอร์เข้ามา</p>
          ) : (
            orders.map((o) => (
              <div key={o._id} className="bg-white p-3 rounded-2xl shadow-sm space-y-2">
                <div className="flex justify-between items-center">
                  <OrderStatus status={o.status} />
                  <span className="text-[10px] text-slate-400">{new Date(o.createdAt).toLocaleString('th-TH')}</span>
                </div>

                {o.items.map((it, idx) => (
                  <div key={idx} className="flex gap-3 items-center">
                    <ProductImage src={it.imageUrl} alt={it.name} className="w-12 h-12 rounded-lg shrink-0" iconSize={18} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 line-clamp-2">{it.name || 'สินค้า'}</p>
                      <p className="text-[11px] text-slate-500">฿ {baht(it.price)} × {it.quantity}</p>
                    </div>
                  </div>
                ))}

                <div className="bg-slate-50 rounded-xl p-2 text-[11px] text-slate-600 space-y-0.5">
                  <p className="font-bold text-slate-700">จัดส่งถึง: {o.shippingName || o.buyerId?.name}</p>
                  {(o.shippingPhone || o.buyerId?.phone) && <p>โทร {o.shippingPhone || o.buyerId?.phone}</p>}
                  <p className="whitespace-pre-line">{o.shippingAddress}</p>
                </div>

                <div className="flex justify-between text-xs font-bold text-slate-800">
                  <span>ยอดรวม</span>
                  <span>฿ {baht(o.totalAmount)}</span>
                </div>
                <p className="text-[10px] text-slate-500">💰 {ESCROW_TEXT[o.escrowStatus]}</p>

                {o.trackingNumber && (
                  <p className="text-xs text-slate-500">Tracking: <span className="font-mono text-slate-800">{o.trackingNumber}</span></p>
                )}

                {o.status === 'PENDING_SHIPMENT' && (
                  <div className="space-y-2 border-t pt-2">
                    <input
                      aria-label="เลขพัสดุ"
                      value={tracking[o._id] || ''}
                      onChange={(e) => setTracking({ ...tracking, [o._id]: e.target.value })}
                      placeholder="กรอกเลขพัสดุ เช่น TH884019234"
                      className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none focus:border-cyan-500"
                    />
                    <div className="flex gap-2">
                      <button
                        disabled={busyId === o._id || !(tracking[o._id] || '').trim()}
                        onClick={() => ship(o)}
                        className="flex-1 bg-[#8be0e0] hover:bg-cyan-300 text-slate-900 font-bold py-2 rounded-full text-xs disabled:opacity-40"
                      >
                        ยืนยันการจัดส่ง
                      </button>
                      <button
                        disabled={busyId === o._id}
                        onClick={() => reject(o)}
                        className="px-4 bg-white border border-red-200 text-red-500 font-bold py-2 rounded-full text-xs disabled:opacity-40"
                      >
                        ปฏิเสธ
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )
        ) : (
          <div className="space-y-3">
            <Link href="/seller/products/new" className="flex items-center justify-center gap-1 bg-slate-800 text-white font-bold py-2.5 rounded-full text-sm">
              <Plus size={16} /> ลงขายสินค้าใหม่
            </Link>

            {products.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-10">ยังไม่มีสินค้าในร้าน</p>
            ) : (
              products.map((p) => (
                <div key={p._id} className="bg-white p-3 rounded-2xl shadow-sm flex gap-3 items-center">
                  <ProductImage src={p.imageUrl} alt={p.name} className="w-16 h-16 rounded-lg shrink-0" iconSize={22} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 line-clamp-2">{p.name}</p>
                    <p className="text-xs font-black text-slate-900 mt-0.5">฿ {baht(p.price)}</p>
                    <p className={`text-[10px] font-bold ${p.stock < 1 ? 'text-red-500' : 'text-slate-500'}`}>
                      {p.stock < 1 ? 'สินค้าหมด' : `สต็อก ${p.stock}`}
                    </p>
                  </div>
                  <Link href={`/seller/products/${p._id}`} aria-label={`แก้ไข ${p.name}`} className="p-2 bg-slate-100 rounded-full text-slate-700">
                    <Pencil size={15} />
                  </Link>
                  <button disabled={busyId === p._id} onClick={() => remove(p)} aria-label={`ลบ ${p.name}`} className="p-2 bg-red-50 rounded-full text-red-500 disabled:opacity-40">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))
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
