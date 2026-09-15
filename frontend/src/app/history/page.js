'use client';
import { useState } from 'react';

export default function OrderHistoryPage() {
  const [tab, setTab] = useState('active'); // active | completed

  return (
    <div className="bg-[#e0f7f7] min-h-screen">
      <div className="bg-[#8be0e0] p-4"><button className="text-2xl font-bold">☰</button></div>

      <div className="p-4 space-y-4">
        <h1 className="text-center font-bold text-slate-700">สถานะคำสั่งซื้อ</h1>

        {/* Tabs */}
        <div className="flex justify-center border-b border-cyan-300 text-sm font-semibold">
          <button
            onClick={() => setTab('active')}
            className={`pb-2 px-6 ${tab === 'active' ? 'border-b-2 border-slate-800 text-slate-900' : 'text-slate-400'}`}
          >
            กำลังดำเนินการ
          </button>
          <button
            onClick={() => setTab('completed')}
            className={`pb-2 px-6 ${tab === 'completed' ? 'border-b-2 border-slate-800 text-slate-900' : 'text-slate-400'}`}
          >
            เสร็จสิ้น
          </button>
        </div>

        {/* Order Card Item */}
        {tab === 'active' ? (
          <div className="bg-white p-3 rounded-2xl shadow-sm flex gap-3 items-center">
            <div className="w-16 h-16 bg-slate-200 rounded-lg flex-shrink-0"></div>
            <div className="flex-1 space-y-1">
              <span className="text-xs font-bold text-emerald-600">สินค้ากำลังจัดส่ง</span>
              <p className="text-xs text-slate-500">Tracking Number: <span className="font-mono text-slate-800">TH884019234</span></p>
              <button onClick={() => navigator.clipboard.writeText('TH884019234')} className="bg-[#8be0e0] text-[10px] px-2 py-0.5 rounded font-bold">
                COPY
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-10 text-slate-400 text-sm">ไม่มีรายการที่เสร็จสิ้น</div>
        )}
      </div>
    </div>
  );
}