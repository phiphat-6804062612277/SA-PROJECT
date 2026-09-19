'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ShieldAlert, Scale } from 'lucide-react';
import API, { errorMessage } from '@/lib/api';
import { baht } from '@/lib/auth';
import { useAuth } from '@/lib/useAuth';
import ProductImage from '@/components/ProductImage';
import PageHeader from '@/components/PageHeader';
import Avatar from '@/components/Avatar';
import Loading from '@/components/Loading';
import Notice from '@/components/Notice';
import ReviewBox from '@/components/ReviewBox';
import { useToast } from '@/components/Toast';
import OrderStatus, { escrowText } from '@/components/OrderStatus';
import AutoReleaseCountdown from '@/components/AutoReleaseCountdown';
import DisputeDialog from '@/components/DisputeDialog';

export default function OrderHistoryPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('active'); // active | completed
  const [orders, setOrders] = useState(null);
  const [message, setMessage] = useState({ type: 'info', text: '' });
  const [busyId, setBusyId] = useState('');
  const [copied, setCopied] = useState('');
  const [disputeOrder, setDisputeOrder] = useState(null); // ออเดอร์ที่กำลังกรอกฟอร์มเปิดข้อพิพาท

  const load = useCallback(async () => {
    try {
      setOrders((await API.get('/orders/mine')).data);
    } catch (err) {
      setOrders([]);
      setMessage({ type: 'error', text: errorMessage(err) });
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const act = async (order, action, confirmText, okText) => {
    if (!window.confirm(confirmText)) return;
    setBusyId(order._id);
    setMessage({ type: 'info', text: '' });
    try {
      await API.put(`/orders/${order._id}/${action}`);
      toast.success(okText);
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: errorMessage(err) });
    } finally {
      setBusyId('');
    }
  };

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(''), 1500);
    } catch {
      /* clipboard ไม่พร้อมใช้งาน */
    }
  };

  if (!user || orders === null) return <Loading />;

  const isActive = (o) => ['PENDING_SHIPMENT', 'SHIPPED', 'DISPUTED'].includes(o.status);
  const shown = orders.filter((o) => (tab === 'active' ? isActive(o) : !isActive(o)));

  return (
    <div className="bg-[#e0f7f7] min-h-screen">
      <PageHeader title="สถานะคำสั่งซื้อ" back />

      <div className="p-4 space-y-4">
        <div className="flex justify-center border-b border-cyan-300 text-sm font-semibold" role="tablist">
          {[
            ['active', 'กำลังดำเนินการ'],
            ['completed', 'เสร็จสิ้น / ยกเลิก'],
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

        {shown.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm space-y-3">
            <p>{tab === 'active' ? 'ยังไม่มีคำสั่งซื้อที่กำลังดำเนินการ' : 'ไม่มีรายการที่เสร็จสิ้น'}</p>
            {tab === 'active' && (
              <Link href="/shopping" className="inline-block bg-[#9bdadd] text-slate-900 font-bold px-5 py-2 rounded-full text-xs">
                เลือกซื้อสินค้า
              </Link>
            )}
          </div>
        ) : (
          shown.map((o) => (
            <div key={o._id} className="bg-white p-3 rounded-2xl shadow-sm space-y-2">
              <div className="flex justify-between items-center">
                <OrderStatus status={o.status} />
                <span className="text-[10px] text-slate-400">{new Date(o.createdAt).toLocaleDateString('th-TH')}</span>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <Avatar src={o.sellerId?.storeLogoUrl} name={o.sellerId?.storeName || o.sellerId?.name || '-'} size={22} />
                <p className="text-[11px] text-slate-500 truncate">ร้าน {o.sellerId?.storeName || o.sellerId?.name || '-'}</p>
              </div>

              {o.items.map((it, idx) => (
                <div key={idx} className="flex gap-3 items-center">
                  <ProductImage src={it.imageUrl} alt={it.name} className="w-14 h-14 rounded-lg shrink-0" iconSize={20} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 line-clamp-2 text-wrap-safe">{it.name || 'สินค้า'}</p>
                    <p className="text-[11px] text-slate-500">฿ {baht(it.price)} × {it.quantity}</p>
                  </div>
                </div>
              ))}

              <div className="flex justify-between text-xs font-bold text-slate-800 border-t pt-2">
                <span>รวม</span>
                <span className="money">฿ {baht(o.totalAmount)}</span>
              </div>
              <p className="text-[10px] text-slate-500">💰 {escrowText(o)}</p>

              {o.trackingNumber && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Tracking:</span>
                  <span className="font-mono text-slate-800">{o.trackingNumber}</span>
                  <button onClick={() => copy(o.trackingNumber)} className="bg-[#9bdadd] text-[10px] px-2 py-0.5 rounded font-bold text-slate-900">
                    {copied === o.trackingNumber ? 'COPIED' : 'COPY'}
                  </button>
                </div>
              )}

              {o.status === 'SHIPPED' && (
                <div className="space-y-2">
                  <AutoReleaseCountdown at={o.autoReleaseAt} role="buyer" />
                  <button
                    disabled={busyId === o._id}
                    onClick={() => act(o, 'complete', 'ยืนยันว่าได้รับสินค้าแล้ว? เงินจะถูกโอนให้ผู้ขายทันที', 'ยืนยันรับสินค้าแล้ว เงินถูกโอนให้ผู้ขายเรียบร้อย')}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 rounded-full text-xs disabled:opacity-50"
                  >
                    ยืนยันรับสินค้า
                  </button>
                  {o.disputeId ? (
                    <Link href={`/disputes/${o.disputeId}`} className="block text-center text-[11px] font-bold text-slate-500 underline underline-offset-2">
                      คำร้องข้อพิพาทถูกปฏิเสธโดย Admin — ดูเหตุผล (เปิดข้อพิพาทซ้ำไม่ได้)
                    </Link>
                  ) : (
                    <button
                      disabled={busyId === o._id}
                      onClick={() => setDisputeOrder(o)}
                      className="w-full inline-flex items-center justify-center gap-1.5 bg-white border border-red-200 text-red-500 hover:bg-red-50 font-bold py-2 rounded-full text-xs disabled:opacity-50"
                    >
                      <ShieldAlert size={14} /> ขอเปิดข้อพิพาท / ขอคืนเงิน
                    </button>
                  )}
                </div>
              )}
              {o.status === 'DISPUTED' && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-2.5 space-y-2">
                  <p className="text-[11px] text-red-700">
                    คุณเปิดข้อพิพาทแล้ว เงินถูก Freeze ไว้และหยุดการปล่อยเงินอัตโนมัติ รอ Admin ตัดสิน
                  </p>
                  {o.disputeId && (
                    <Link href={`/disputes/${o.disputeId}`} className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 underline underline-offset-2">
                      <Scale size={12} /> ดูรายละเอียด / ส่งข้อความในข้อพิพาท
                    </Link>
                  )}
                </div>
              )}
              {(o.status === 'REFUNDED' || o.status === 'COMPLETED') && o.disputeId && (
                <Link href={`/disputes/${o.disputeId}`} className="inline-flex items-center gap-1 text-[11px] font-bold text-violet-600 underline underline-offset-2">
                  <Scale size={12} /> ดูผลการตัดสินข้อพิพาท
                </Link>
              )}
              <ReviewBox order={o} as="buyer" onDone={load} />
              {o.status === 'PENDING_SHIPMENT' && (
                <button
                  disabled={busyId === o._id}
                  onClick={() => act(o, 'cancel', 'ต้องการยกเลิกคำสั่งซื้อนี้และรับเงินคืนใช่หรือไม่?', 'ยกเลิกคำสั่งซื้อและคืนเงินเข้า Wallet แล้ว')}
                  className="w-full bg-white border border-red-200 text-red-500 font-bold py-2 rounded-full text-xs disabled:opacity-50"
                >
                  ยกเลิกคำสั่งซื้อ (คืนเงิน)
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {disputeOrder && (
        <DisputeDialog
          order={disputeOrder}
          onClose={() => setDisputeOrder(null)}
          onDone={async () => {
            setDisputeOrder(null);
            await load();
          }}
        />
      )}
    </div>
  );
}
