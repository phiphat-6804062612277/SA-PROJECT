'use client';
import { useState } from 'react';
import API, { errorMessage } from '@/lib/api';
import { baht } from '@/lib/auth';
import PageHeader from '@/components/PageHeader';
import Notice from '@/components/Notice';

// ฟอร์มกรอกจำนวนเงิน ใช้ร่วมกันระหว่างหน้าเติมเงิน / ถอนเงิน
export default function AmountForm({ title, endpoint, submitLabel, successText, quickAmounts, onDone }) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [balance, setBalance] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const value = Number(amount);
    if (!value || value <= 0) {
      setError('กรุณากรอกจำนวนเงินให้ถูกต้อง');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await API.post(endpoint, { amount: value });
      setBalance(res.data.balance);
      onDone(value, res.data.balance);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#e0f7f7] min-h-screen">
      <PageHeader title={title} back />
      <div className="p-4">
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-3xl shadow-sm space-y-4 max-w-md mx-auto">
          <div>
            <label htmlFor="amount" className="text-xs font-bold text-slate-700 block mb-2">จำนวนเงิน (บาท)</label>
            <input
              id="amount"
              type="number"
              inputMode="decimal"
              min="1"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-slate-100 text-slate-900 border-none rounded-xl p-3 text-lg font-bold outline-none focus:ring-2 focus:ring-cyan-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {quickAmounts.map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setAmount(String(val))}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold py-2.5 rounded-xl transition"
              >
                {baht(val)} ฿
              </button>
            ))}
          </div>

          <Notice type="error">{error}</Notice>
          {balance !== null && <Notice type="success">{successText}</Notice>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#8be0e0] hover:bg-cyan-300 text-slate-900 font-bold py-3 rounded-full text-sm transition shadow-sm disabled:opacity-50"
          >
            {loading ? 'กำลังประมวลผล...' : submitLabel}
          </button>
        </form>
      </div>
    </div>
  );
}
