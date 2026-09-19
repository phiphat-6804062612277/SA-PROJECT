'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, Lock, Scale } from 'lucide-react';
import API, { errorMessage } from '@/lib/api';
import { baht } from '@/lib/auth';
import ProductImage from '@/components/ProductImage';
import ReviewBox from '@/components/ReviewBox';
import OrderStatus, { escrowText } from '@/components/OrderStatus';
import AutoReleaseCountdown from '@/components/AutoReleaseCountdown';
import { RatingSummary } from '@/components/StarRating';
import Avatar from '@/components/Avatar';
import TrustBadge from '@/components/TrustBadge';
import { useToast } from '@/components/Toast';

// การ์ดออเดอร์ในแดชบอร์ดผู้ขาย: ดูสรุปได้ในพริบตา กดขยายเพื่อดูที่อยู่จัดส่ง / ใส่เลขพัสดุ / รีวิวผู้ซื้อ
export default function SellerOrderCard({ order: o, onChanged }) {
  const toast = useToast();
  const pending = o.status === 'PENDING_SHIPMENT';
  const [open, setOpen] = useState(pending); // ออเดอร์ที่ต้องจัดส่งจะขยายให้เลย
  const [tracking, setTracking] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (fn, okText) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      toast.success(okText);
      await onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const ship = () =>
    run(() => API.put(`/orders/${o._id}/ship`, { trackingNumber: tracking.trim() }), 'บันทึกเลขพัสดุแล้ว สถานะเป็น "จัดส่งแล้ว"');

  const confirmShip = () => {
    if (!window.confirm(`ยืนยันเลขพัสดุ "${tracking.trim().toUpperCase()}" ?\n\nบันทึกแล้วจะแก้ไขเองไม่ได้`)) return;
    ship();
  };

  const reject = () => {
    if (!window.confirm('ปฏิเสธออเดอร์นี้? ระบบจะคืนเงินให้ผู้ซื้อทั้งหมดและคืนสต็อกสินค้า')) return;
    run(() => API.put(`/orders/${o._id}/cancel`), 'ปฏิเสธออเดอร์และคืนเงินผู้ซื้อแล้ว');
  };

  const shownItems = open ? o.items : o.items.slice(0, 1);
  const buyerName = o.shippingName || o.buyerId?.name || 'ผู้ซื้อ';

  return (
    <div className={`bg-white rounded-2xl shadow-sm overflow-hidden ${pending ? 'ring-2 ring-amber-300' : ''}`}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-3 pt-3 pb-2 text-left"
      >
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-800">
            #{String(o._id).slice(-6).toUpperCase()} <span className="font-normal text-slate-400">· {new Date(o.createdAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}</span>
          </p>
          <p className="text-[11px] text-slate-500 truncate">{buyerName}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <OrderStatus status={o.status} />
          {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
      </button>

      <div className="px-3 pb-3 space-y-2">
        {shownItems.map((it, idx) => (
          <div key={idx} className="flex gap-3 items-center">
            <ProductImage src={it.imageUrl} alt={it.name} className="w-11 h-11 rounded-lg shrink-0" iconSize={16} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-800 line-clamp-1 text-wrap-safe">{it.name || 'สินค้า'}</p>
              <p className="text-[11px] text-slate-500">฿ {baht(it.price)} × {it.quantity}</p>
            </div>
          </div>
        ))}
        {!open && o.items.length > 1 && <p className="text-[11px] text-slate-400">และอีก {o.items.length - 1} รายการ</p>}

        <div className="flex justify-between text-xs font-bold text-slate-800">
          <span>ยอดรวม</span>
          <span className="money">฿ {baht(o.totalAmount)}</span>
        </div>

        {open && (
          <>
            <p className="text-[10px] text-slate-500">💰 {escrowText(o)}</p>

            <div className="bg-slate-50 rounded-xl p-2.5 text-[11px] text-slate-600 space-y-1">
              <div className="flex items-center gap-2">
                <Avatar src={o.buyerId?.avatarUrl} name={o.buyerId?.name || buyerName} size={32} />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="font-bold text-slate-700 truncate">จัดส่งถึง: {buyerName}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <TrustBadge trust={o.buyerTrust} compact />
                    <RatingSummary rating={o.buyerRating} emptyText="" size={12} />
                  </div>
                </div>
              </div>
              {(o.shippingPhone || o.buyerId?.phone) && <p>โทร {o.shippingPhone || o.buyerId?.phone}</p>}
              <p className="text-wrap-safe">{o.shippingAddress}</p>
            </div>

            {o.trackingNumber && (
              <div className="text-xs text-slate-500 space-y-0.5">
                <p className="flex items-center gap-1.5">
                  เลขพัสดุ: <span className="font-mono text-slate-800 font-bold">{o.trackingNumber}</span>
                  <Lock size={11} className="text-slate-400" aria-label="แก้ไขไม่ได้" />
                </p>
                <p className="text-[10px] text-slate-400">บันทึกแล้วแก้ไขเองไม่ได้ (หากผิดพลาดกรุณาติดต่อ Admin)</p>
              </div>
            )}

            {o.status === 'SHIPPED' && <AutoReleaseCountdown at={o.autoReleaseAt} role="seller" />}

            {o.status === 'DISPUTED' && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-2.5 space-y-2">
                <p className="text-[11px] text-red-700">
                  ผู้ซื้อเปิดข้อพิพาท เงินของออเดอร์นี้ถูก Freeze ไว้ในระบบ Escrow จนกว่า Admin จะตัดสิน
                </p>
                {o.disputeId && (
                  <Link href={`/disputes/${o.disputeId}`} className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 underline underline-offset-2">
                    <Scale size={12} /> ดูรายละเอียด / ชี้แจงในข้อพิพาท
                  </Link>
                )}
              </div>
            )}
            {(o.status === 'COMPLETED' || o.status === 'REFUNDED') && o.disputeId && (
              <Link href={`/disputes/${o.disputeId}`} className="inline-flex items-center gap-1 text-[11px] font-bold text-violet-600 underline underline-offset-2">
                <Scale size={12} /> ดูผลการตัดสินข้อพิพาท
              </Link>
            )}

            {pending && (
              <div className="space-y-2 border-t pt-2">
                <input
                  aria-label="เลขพัสดุ"
                  value={tracking}
                  maxLength={40}
                  onChange={(e) => setTracking(e.target.value)}
                  placeholder="กรอกเลขพัสดุ เช่น TH884019234"
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none focus:border-cyan-500"
                />
                <p className="text-[10px] text-slate-400">
                  เลขพัสดุ 8-30 ตัว (A-Z, 0-9) ห้ามซ้ำกับออเดอร์อื่น และแก้ไขไม่ได้หลังบันทึก หลังจัดส่งระบบจะปล่อยเงินให้อัตโนมัติเมื่อครบกำหนด (ค่าเริ่มต้น 7 วัน) หากผู้ซื้อไม่เปิดข้อพิพาท
                </p>
                {error && <p className="text-xs text-red-500 font-semibold" role="alert">{error}</p>}
                <div className="flex gap-2">
                  <button
                    disabled={busy || !tracking.trim()}
                    onClick={confirmShip}
                    className="flex-1 bg-[#9bdadd] hover:bg-cyan-300 text-slate-900 font-bold py-2 rounded-full text-xs disabled:opacity-40"
                  >
                    ยืนยันการจัดส่ง
                  </button>
                  <button
                    disabled={busy}
                    onClick={reject}
                    className="px-4 bg-white border border-red-200 text-red-500 font-bold py-2 rounded-full text-xs disabled:opacity-40"
                  >
                    ปฏิเสธ
                  </button>
                </div>
              </div>
            )}

            {!pending && error && <p className="text-xs text-red-500 font-semibold" role="alert">{error}</p>}
            <ReviewBox order={o} as="seller" onDone={onChanged} />
          </>
        )}
      </div>
    </div>
  );
}
