'use client';
import { useEffect, useState } from 'react';
import { LIMITS } from '@/lib/limits';

// กล่องยืนยันพร้อมช่องกรอกเหตุผล (ใช้ตอน Admin แบนผู้ใช้/ร้านค้า)
export default function ReasonDialog({ title, description, confirmLabel = 'ยืนยัน', busy = false, onConfirm, onCancel }) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center px-6" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-black/50" aria-label="ปิด" onClick={onCancel} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm(reason.trim());
        }}
        className="relative bg-white rounded-3xl p-5 w-full max-w-sm space-y-3 shadow-xl"
      >
        <h2 className="font-bold text-slate-900">{title}</h2>
        {description && <p className="text-xs text-slate-600 text-wrap-safe">{description}</p>}
        <div>
          <label htmlFor="ban-reason" className="text-xs font-bold text-slate-700">เหตุผล (ผู้ใช้จะเห็นข้อความนี้)</label>
          <textarea
            id="ban-reason"
            rows={3}
            maxLength={LIMITS.BAN_REASON}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            autoFocus
            className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs focus:outline-none focus:border-cyan-500"
            placeholder="เช่น ละเมิดกฎการใช้งาน / สินค้าไม่เหมาะสม"
          />
          <p className="text-[10px] text-slate-400 text-right">{reason.length}/{LIMITS.BAN_REASON}</p>
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-full text-sm disabled:opacity-50">
            {busy ? 'กำลังดำเนินการ...' : confirmLabel}
          </button>
          <button type="button" onClick={onCancel} className="flex-1 bg-slate-200 text-slate-700 font-bold py-2.5 rounded-full text-sm">
            ยกเลิก
          </button>
        </div>
      </form>
    </div>
  );
}
