'use client';
import { useEffect, useState } from 'react';
import { Plus, X, ShieldAlert } from 'lucide-react';
import API, { errorMessage } from '@/lib/api';
import { baht } from '@/lib/auth';
import { LIMITS } from '@/lib/limits';
import ProductImage from '@/components/ProductImage';
import { useToast } from '@/components/Toast';

const inputCls =
  'w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none focus:border-cyan-500';

// ฟอร์ม "ขอเปิดข้อพิพาท / ขอคืนเงิน" ของผู้ซื้อ (ใช้ได้เมื่อออเดอร์อยู่ในสถานะ SHIPPED)
export default function DisputeDialog({ order, onClose, onDone }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [images, setImages] = useState(['']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  const setImage = (i, v) => setImages((list) => list.map((x, idx) => (idx === i ? v : x)));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const text = reason.trim();
    if (text.length < LIMITS.DISPUTE_REASON_MIN) {
      setError(`กรุณาอธิบายเหตุผลอย่างน้อย ${LIMITS.DISPUTE_REASON_MIN} ตัวอักษร`);
      return;
    }
    setBusy(true);
    try {
      const res = await API.post('/disputes', {
        orderId: order._id,
        reason: text,
        evidenceImages: images.map((s) => s.trim()).filter(Boolean),
      });
      toast.success('เปิดข้อพิพาทแล้ว เงินถูกระงับไว้ รอ Admin พิจารณา');
      onDone(res.data.dispute);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label="ขอเปิดข้อพิพาท">
      <button className="absolute inset-0 bg-black/50" aria-label="ปิด" onClick={() => !busy && onClose()} />
      <form onSubmit={submit} className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5 space-y-3 shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldAlert className="text-red-500 shrink-0" size={20} />
            <h2 className="font-bold text-slate-900 text-sm">ขอเปิดข้อพิพาท / ขอคืนเงิน</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="ปิด" className="text-slate-400 hover:text-slate-700">
            <X size={20} />
          </button>
        </div>

        <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-[11px] text-red-700 space-y-1">
          <p>
            ออเดอร์ยอด <b className="money">฿ {baht(order.totalAmount)}</b> จะถูกเปลี่ยนเป็น <b>อยู่ระหว่างข้อพิพาท</b>
          </p>
          <p>เงินจะถูก Freeze ไว้ใน Escrow และ <b>ยกเลิกการปล่อยเงินอัตโนมัติ</b> จนกว่า Admin จะตัดสิน</p>
          <p>เปิดข้อพิพาทได้ครั้งเดียวต่อออเดอร์ และปุ่ม &quot;ยืนยันรับสินค้า&quot; จะใช้ไม่ได้ระหว่างรอผล</p>
        </div>

        <div>
          <div className="flex justify-between items-end">
            <label htmlFor="dsp-reason" className="text-xs font-bold text-slate-700">เหตุผล</label>
            <span className={`text-[10px] ${reason.length >= LIMITS.DISPUTE_REASON ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
              {reason.length}/{LIMITS.DISPUTE_REASON}
            </span>
          </div>
          <textarea
            id="dsp-reason"
            rows={4}
            required
            maxLength={LIMITS.DISPUTE_REASON}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="เช่น ได้รับสินค้าไม่ตรงปก / สินค้าชำรุด / พัสดุไม่ถึงตามกำหนด"
            className={`${inputCls} mt-1 text-wrap-safe`}
          />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-700">
            รูปหลักฐาน (ลิงก์ URL) <span className="font-normal text-slate-400">ไม่เกิน {LIMITS.DISPUTE_IMAGES} รูป</span>
          </p>
          {images.map((url, i) => (
            <div key={i} className="flex gap-2 items-center">
              {url.trim() && <ProductImage src={url.trim()} alt={`หลักฐาน ${i + 1}`} className="w-9 h-9 rounded-lg shrink-0" iconSize={14} />}
              <input
                type="url"
                aria-label={`ลิงก์รูปหลักฐาน ${i + 1}`}
                value={url}
                maxLength={1000}
                onChange={(e) => setImage(i, e.target.value)}
                placeholder="https://..."
                className={inputCls}
              />
              {images.length > 1 && (
                <button type="button" aria-label={`ลบลิงก์ ${i + 1}`} onClick={() => setImages((l) => l.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-red-500">
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
          {images.length < LIMITS.DISPUTE_IMAGES && (
            <button type="button" onClick={() => setImages((l) => [...l, ''])} className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-700">
              <Plus size={13} /> เพิ่มลิงก์รูป
            </button>
          )}
        </div>

        {error && <p className="text-xs text-red-500 font-semibold" role="alert">{error}</p>}

        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-full text-sm disabled:opacity-50">
            {busy ? 'กำลังส่งคำร้อง...' : 'ยืนยันเปิดข้อพิพาท'}
          </button>
          <button type="button" disabled={busy} onClick={onClose} className="flex-1 bg-slate-200 text-slate-700 font-bold py-2.5 rounded-full text-sm">
            ยกเลิก
          </button>
        </div>
      </form>
    </div>
  );
}
