'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import API from '@/lib/api';

export default function TopUpPage() {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  // ปุ่มเติมเงินด่วน
  const quickAmounts = [500, 1000, 5000, 10000];

  const handleTopUp = async (e) => {
    e.preventDefault();
    const topupAmount = Number(amount);
    if (!topupAmount || topupAmount <= 0) {
      alert('กรุณากรอกจำนวนเงินให้ถูกต้อง');
      return;
    }

    setLoading(true);
    try {
      await API.post('/wallet/topup', { amount: topupAmount });
      alert(`เติมเงินสำเร็จ ${topupAmount.toLocaleString()} บาท`);
      router.push('/checkout'); // เติมเงินเสร็จ นำกลับไปหน้ายืนยันชำระเงินทันที
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'เกิดข้อผิดพลาดในการเติมเงิน');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#e0f7f7] min-h-screen p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-slate-700">
          <ArrowLeft size={24} />
        </button>
        <h1 className="font-bold text-slate-800 text-lg">เติมเงินเข้า Wallet</h1>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-sm space-y-4 max-w-md mx-auto">
        <div>
          <label className="text-xs font-bold text-slate-700 block mb-2">จำนวนเงินที่ต้องการเติม (บาท)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full bg-slate-100 text-slate-900 border-none rounded-xl p-3 text-lg font-bold outline-none focus:ring-2 focus:ring-cyan-400"
          />
        </div>

        {/* ปุ่มเลือกจำนวนเงินด่วน */}
        <div className="grid grid-cols-2 gap-2">
          {quickAmounts.map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => setAmount(val.toString())}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold py-2.5 rounded-xl transition"
            >
              +{val.toLocaleString()} ฿
            </button>
          ))}
        </div>

        <button
          onClick={handleTopUp}
          disabled={loading}
          className="w-full bg-[#8be0e0] hover:bg-cyan-300 text-slate-900 font-bold py-3 rounded-full text-sm transition mt-4 shadow-sm disabled:opacity-50"
        >
          {loading ? 'กำลังประมวลผล...' : 'ยืนยันการเติมเงิน'}
        </button>
      </div>
    </div>
  );
}