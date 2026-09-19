'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Undo2, Banknote, Gavel } from 'lucide-react';
import API, { errorMessage } from '@/lib/api';
import { baht } from '@/lib/auth';
import { LIMITS } from '@/lib/limits';
import { useAuth } from '@/lib/useAuth';
import PageHeader from '@/components/PageHeader';
import Loading from '@/components/Loading';
import Notice from '@/components/Notice';
import DisputeView from '@/components/DisputeView';
import { useToast } from '@/components/Toast';

const DECISIONS = {
  REFUND_BUYER: {
    confirm: (amount) => `ยืนยันคืนเงิน ฿${baht(amount)} ให้ผู้ซื้อ?\n\nออเดอร์จะเป็น "คืนเงินแล้ว" และไม่สามารถแก้ไขคำตัดสินได้`,
    done: 'คืนเงินให้ผู้ซื้อเรียบร้อยแล้ว',
  },
  PAY_SELLER: {
    confirm: (amount) => `ยืนยันโอนเงิน ฿${baht(amount)} ให้ผู้ขาย?\n\nออเดอร์จะเป็น "สำเร็จ" และไม่สามารถแก้ไขคำตัดสินได้`,
    done: 'โอนเงินให้ผู้ขายเรียบร้อยแล้ว',
  },
  REJECT: {
    confirm: () => 'ปฏิเสธคำร้องนี้? ออเดอร์จะกลับเป็น "จัดส่งแล้ว" และเริ่มนับถอยหลังปล่อยเงินอัตโนมัติใหม่ (ผู้ซื้อเปิดข้อพิพาทซ้ำไม่ได้)',
    done: 'ปฏิเสธคำร้องแล้ว',
  },
};

// หน้าพิจารณาข้อพิพาท (เฉพาะ Admin): ดูหลักฐาน/เลขพัสดุ/แชต แล้วตัดสิน โดยต้องระบุเหตุผลทุกครั้ง
export default function AdminDisputeDetailPage() {
  const { user } = useAuth({ roles: ['admin'] });
  const toast = useToast();
  const { id } = useParams();
  const [dispute, setDispute] = useState(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async ({ keepError = false } = {}) => {
    try {
      setDispute((await API.get(`/admin/disputes/${id}`)).data);
      if (!keepError) setError('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [id]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (!user) return <Loading />;

  const noteOk = note.trim().length >= LIMITS.DISPUTE_NOTE_MIN;

  const decide = async (decision) => {
    if (!noteOk) {
      setError(`กรุณาระบุเหตุผลการตัดสินอย่างน้อย ${LIMITS.DISPUTE_NOTE_MIN} ตัวอักษรก่อนยืนยัน`);
      return;
    }
    if (!window.confirm(DECISIONS[decision].confirm(dispute.amount))) return;
    setBusy(true);
    setError('');
    try {
      const res = await API.put(`/admin/disputes/${id}/resolve`, { decision, adminNote: note.trim() });
      toast.success(DECISIONS[decision].done);
      setDispute(res.data.dispute);
      setNote('');
    } catch (err) {
      setError(errorMessage(err));
      toast.error(errorMessage(err));
      await load({ keepError: true }); // เผื่อมีแอดมินอีกคนตัดสินไปก่อน จะได้เห็นสถานะล่าสุด (คงข้อความ error ไว้)
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-[#e0f7f7] min-h-screen pb-24">
      <PageHeader title="พิจารณาข้อพิพาท" back right={<Gavel size={20} className="text-slate-700" />} />
      <div className="p-4 space-y-3">
        {!dispute && !error && <Loading />}
        {!dispute && <Notice type="error">{error}</Notice>}

        {dispute && (
          <>
            <DisputeView dispute={dispute} role="admin" onChanged={load} />

            {dispute.status === 'PENDING' ? (
              <section className="bg-white rounded-2xl shadow-sm p-4 space-y-3 ring-2 ring-violet-200">
                <h2 className="text-sm font-bold text-slate-900">คำตัดสินของ Admin</h2>
                <div>
                  <div className="flex justify-between items-end">
                    <label htmlFor="admin-note" className="text-xs font-bold text-slate-700">
                      เหตุผลการตัดสิน <span className="text-red-500">*</span>
                    </label>
                    <span className={`text-[10px] ${note.length >= LIMITS.DISPUTE_NOTE ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
                      {note.length}/{LIMITS.DISPUTE_NOTE}
                    </span>
                  </div>
                  <textarea
                    id="admin-note"
                    rows={3}
                    maxLength={LIMITS.DISPUTE_NOTE}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="บันทึกเหตุผลที่ตัดสิน (คู่กรณีจะเห็นข้อความนี้)"
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none focus:border-violet-400 text-wrap-safe"
                  />
                  <p className="text-[10px] text-slate-400">ต้องกรอกอย่างน้อย {LIMITS.DISPUTE_NOTE_MIN} ตัวอักษรก่อนกดตัดสิน</p>
                </div>

                <Notice type="error">{error}</Notice>

                <div className="space-y-2">
                  <button
                    disabled={busy || !noteOk}
                    onClick={() => decide('REFUND_BUYER')}
                    className="w-full inline-flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 rounded-full text-sm disabled:opacity-40"
                  >
                    <Undo2 size={16} /> อนุมัติคืนเงินให้ผู้ซื้อ (Refund Buyer)
                  </button>
                  <button
                    disabled={busy || !noteOk}
                    onClick={() => decide('PAY_SELLER')}
                    className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-full text-sm disabled:opacity-40"
                  >
                    <Banknote size={16} /> อนุมัติโอนเงินให้ผู้ขาย (Release to Seller)
                  </button>
                  <button
                    disabled={busy || !noteOk}
                    onClick={() => decide('REJECT')}
                    className="w-full text-[11px] font-bold text-slate-500 hover:text-slate-800 underline underline-offset-2 disabled:opacity-40 py-1"
                  >
                    ปฏิเสธคำร้อง (ไม่พบข้อบกพร่อง — ดำเนินการซื้อขายต่อ)
                  </button>
                </div>
              </section>
            ) : (
              <Notice type="info">ข้อพิพาทนี้ตัดสินแล้ว ไม่สามารถตัดสินซ้ำได้</Notice>
            )}
          </>
        )}
      </div>
    </div>
  );
}
