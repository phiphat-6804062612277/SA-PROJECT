'use client';
import { useState } from 'react';
import { Send, Truck, MessageSquare, ExternalLink } from 'lucide-react';
import API, { errorMessage } from '@/lib/api';
import { baht } from '@/lib/auth';
import { LIMITS } from '@/lib/limits';
import ProductImage from '@/components/ProductImage';
import Notice from '@/components/Notice';
import Avatar from '@/components/Avatar';
import { useToast } from '@/components/Toast';

export const DISPUTE_STATUS = {
  PENDING: { label: 'รอ Admin พิจารณา', cls: 'bg-amber-100 text-amber-700' },
  RESOLVED_REFUND_BUYER: { label: 'คืนเงินให้ผู้ซื้อ', cls: 'bg-violet-100 text-violet-700' },
  RESOLVED_PAY_SELLER: { label: 'โอนเงินให้ผู้ขาย', cls: 'bg-emerald-100 text-emerald-700' },
  REJECTED: { label: 'ปฏิเสธคำร้อง', cls: 'bg-slate-200 text-slate-600' },
};

export const DisputeBadge = ({ status }) => {
  const s = DISPUTE_STATUS[status] || { label: status, cls: 'bg-slate-100 text-slate-600' };
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${s.cls}`}>{s.label}</span>;
};

const fmt = (d) => (d ? new Date(d).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '-');

const Card = ({ title, children }) => (
  <section className="bg-white rounded-2xl shadow-sm p-4 space-y-2">
    {title && <h2 className="text-xs font-bold text-slate-500">{title}</h2>}
    {children}
  </section>
);

const ROLE_STYLE = {
  buyer: 'bg-cyan-50 border-cyan-100',
  seller: 'bg-amber-50 border-amber-100',
  admin: 'bg-violet-50 border-violet-100',
};
const ROLE_LABEL = { buyer: 'ผู้ซื้อ', seller: 'ผู้ขาย', admin: 'Admin' };

// รายละเอียดข้อพิพาท (ใช้ร่วมกันระหว่างผู้ซื้อ / ผู้ขาย / Admin)
//   role: 'buyer' | 'seller' | 'admin'   dispute: ข้อมูลจาก GET /disputes/:id หรือ /admin/disputes/:id
export default function DisputeView({ dispute: d, role, onChanged }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const pending = d.status === 'PENDING';

  const send = async (e) => {
    e.preventDefault();
    const msg = text.trim();
    if (!msg) return;
    setSending(true);
    setError('');
    try {
      await API.post(`/disputes/${d.id}/messages`, { text: msg });
      setText('');
      await onChanged();
    } catch (err) {
      setError(errorMessage(err));
      toast.error(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-800">ออเดอร์ #{String(d.orderId).slice(-6).toUpperCase()}</p>
            <p className="text-[10px] text-slate-400">เปิดข้อพิพาทเมื่อ {fmt(d.createdAt)}</p>
          </div>
          <DisputeBadge status={d.status} />
        </div>
        <div className="flex justify-between items-center bg-red-50 rounded-xl px-3 py-2">
          <span className="text-[11px] font-bold text-red-600">{pending ? 'ยอดเงินที่ถูก Freeze' : 'ยอดเงินในข้อพิพาท'}</span>
          <span className="text-sm font-black text-red-600 money">฿ {baht(d.amount)}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
          <div className="bg-slate-50 rounded-xl p-2 min-w-0">
            <p className="text-[10px] text-slate-400 mb-1">ผู้ซื้อ</p>
            <Avatar src={d.buyer.avatarUrl} name={d.buyer.name} size={32} />
            <p className="font-bold text-slate-800 text-wrap-safe mt-1">{d.buyer.name}</p>
            {d.buyer.email && <p className="text-wrap-safe">{d.buyer.email}</p>}
            {d.buyer.phone && <p>โทร {d.buyer.phone}</p>}
          </div>
          <div className="bg-slate-50 rounded-xl p-2 min-w-0">
            <p className="text-[10px] text-slate-400 mb-1">ผู้ขาย</p>
            <Avatar src={d.seller.avatarUrl} name={d.seller.storeName || d.seller.name} size={32} />
            <p className="font-bold text-slate-800 text-wrap-safe mt-1">{d.seller.storeName || d.seller.name}</p>
            {d.seller.email && <p className="text-wrap-safe">{d.seller.email}</p>}
            {d.seller.phone && <p>โทร {d.seller.phone}</p>}
          </div>
        </div>
      </Card>

      {!pending && (
        <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 space-y-1">
          <p className="text-xs font-bold text-violet-800">{d.statusText}</p>
          <p className="text-xs text-slate-700 text-wrap-safe">เหตุผลของ Admin: {d.adminNote}</p>
          <p className="text-[10px] text-slate-400">ตัดสินเมื่อ {fmt(d.resolvedAt)}</p>
        </div>
      )}

      <Card title="เหตุผลของผู้ซื้อ">
        <p className="text-sm text-slate-800 text-wrap-safe">{d.reason}</p>
        {d.evidenceImages.length > 0 && (
          <div className="grid grid-cols-3 gap-2 pt-1">
            {d.evidenceImages.map((url, i) => (
              <a key={url + i} href={url} target="_blank" rel="noopener noreferrer" className="relative block" aria-label={`เปิดรูปหลักฐาน ${i + 1}`}>
                <ProductImage src={url} alt={`หลักฐาน ${i + 1}`} className="w-full aspect-square rounded-xl" iconSize={20} />
                <ExternalLink size={12} className="absolute right-1 top-1 text-white drop-shadow" />
              </a>
            ))}
          </div>
        )}
        {d.evidenceImages.length === 0 && <p className="text-[11px] text-slate-400">ไม่ได้แนบรูปหลักฐาน</p>}
      </Card>

      {d.order && (
        <Card title="สินค้าและการจัดส่ง">
          {d.order.items.map((it, idx) => (
            <div key={idx} className="flex gap-3 items-center">
              <ProductImage src={it.imageUrl} alt={it.name} className="w-12 h-12 rounded-lg shrink-0" iconSize={18} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800 line-clamp-2 text-wrap-safe">{it.name || 'สินค้า'}</p>
                <p className="text-[11px] text-slate-500 money">฿ {baht(it.price)} × {it.quantity}</p>
              </div>
            </div>
          ))}
          <div className="flex justify-between text-xs font-bold text-slate-800 border-t pt-2">
            <span>ยอดรวมในออเดอร์</span>
            <span className="money">฿ {baht(d.order.totalAmount)}</span>
          </div>
          <div className="bg-slate-50 rounded-xl p-2.5 text-[11px] text-slate-600 space-y-1">
            <p className="flex items-center gap-1.5">
              <Truck size={13} className="text-sky-500" /> เลขพัสดุ: <span className="font-mono text-slate-900 font-bold">{d.order.trackingNumber || '-'}</span>
            </p>
            <p>ผู้ขายจัดส่งเมื่อ {fmt(d.order.shippedAt)}</p>
            {d.order.shippingAddress && <p className="text-wrap-safe">ที่อยู่จัดส่ง: {d.order.shippingName} — {d.order.shippingAddress}</p>}
          </div>
        </Card>
      )}

      <Card title="ประวัติการดำเนินการ">
        <ol className="space-y-2 border-l-2 border-cyan-200 ml-1.5">
          {d.timeline.map((t, i) => (
            <li key={i} className="pl-3 relative">
              <span className="absolute -left-[7px] top-1 w-2.5 h-2.5 rounded-full bg-cyan-400" />
              <p className="text-[11px] text-slate-800 text-wrap-safe">{t.text}</p>
              <p className="text-[10px] text-slate-400">{fmt(t.at)}</p>
            </li>
          ))}
        </ol>
      </Card>

      <Card title="ข้อความระหว่างคู่กรณี">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <MessageSquare size={13} /> ผู้ซื้อ ผู้ขาย และ Admin ส่งข้อความได้จนกว่าจะตัดสิน
        </div>
        {d.messages.length === 0 ? (
          <p className="text-center text-[11px] text-slate-400 py-3">ยังไม่มีข้อความ</p>
        ) : (
          <ul className="space-y-2 max-h-72 overflow-y-auto">
            {d.messages.map((m) => (
              <li key={m.id} className={`flex items-start gap-1.5 ${m.senderRole === role ? 'flex-row-reverse ml-4' : 'mr-4'}`}>
                <Avatar src={m.senderAvatarUrl} name={m.senderName} size={28} />
                <div className={`flex-1 min-w-0 border rounded-xl p-2 ${ROLE_STYLE[m.senderRole]}`}>
                  <p className="text-[10px] font-bold text-slate-500">
                    {m.senderName} <span className="font-normal">({ROLE_LABEL[m.senderRole]}) · {fmt(m.createdAt)}</span>
                  </p>
                  <p className="text-xs text-slate-800 text-wrap-safe">{m.text}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {pending ? (
          <form onSubmit={send} className="space-y-1.5 pt-1">
            <Notice type="error">{error}</Notice>
            <div className="flex gap-2 items-end">
              <textarea
                aria-label="พิมพ์ข้อความ"
                rows={2}
                value={text}
                maxLength={LIMITS.DISPUTE_MESSAGE}
                onChange={(e) => setText(e.target.value)}
                placeholder="พิมพ์ข้อความถึงคู่กรณี / Admin"
                className="flex-1 p-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none focus:border-cyan-500 text-wrap-safe"
              />
              <button type="submit" disabled={sending || !text.trim()} aria-label="ส่งข้อความ" className="bg-[#9bdadd] hover:bg-cyan-300 text-slate-900 p-3 rounded-full disabled:opacity-40">
                <Send size={16} />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 text-right">{text.length}/{LIMITS.DISPUTE_MESSAGE}</p>
          </form>
        ) : (
          <p className="text-[11px] text-slate-400 text-center pt-1">ข้อพิพาทนี้ตัดสินแล้ว ปิดการส่งข้อความ</p>
        )}
      </Card>
    </div>
  );
}
