'use client';
import Link from 'next/link';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';

export default function WalletPage() {
  const transactions = [
    { id: '1', type: 'IN', title: 'รับเงิน', amount: 31000, date: '07 08 69 | 22:05:18' },
    { id: '2', type: 'OUT', title: 'โอนเงิน', amount: 45560, date: '07 05 69 | 14:05:18' },
  ];

  return (
    <div className="bg-[#e0f7f7] min-h-screen">
      <div className="bg-[#8be0e0] p-4"><button className="text-2xl font-bold">☰</button></div>

      <div className="p-4 space-y-4">
        {/* Wallet Balance Box */}
        <div className="bg-slate-100/80 p-5 rounded-3xl text-center shadow-sm space-y-2">
          <h2 className="font-bold text-xl text-slate-800 tracking-wider">💳 WALLET</h2>
          <p className="text-xs text-slate-500">ชื่อ-นามสกุล ผู้ใช้งาน</p>
          <div className="text-2xl font-black text-slate-900">100,090.90 <span className="text-sm font-normal">บาท</span></div>
          
          <Link href="/wallet/topup" className="inline-block bg-[#8be0e0] hover:bg-cyan-300 text-slate-800 font-bold px-6 py-2 rounded-full text-sm transition mt-2">
            เติมเงินเข้า Wallet
          </Link>
        </div>

        {/* Transaction History */}
        <div className="bg-white p-4 rounded-2xl shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-700 border-b pb-2">รายการย้อนหลัง</h3>
          {transactions.map((tx) => (
            <div key={tx.id} className="flex justify-between items-center text-xs border-b pb-2">
              <div className="flex gap-2 items-center">
                {tx.type === 'IN' ? <ArrowDownLeft className="text-emerald-500 w-4 h-4" /> : <ArrowUpRight className="text-red-500 w-4 h-4" />}
                <div>
                  <p className="font-bold text-slate-800">{tx.title}</p>
                  <p className="text-[10px] text-slate-400">{tx.date}</p>
                </div>
              </div>
              <span className={`font-bold ${tx.type === 'IN' ? 'text-emerald-600' : 'text-red-500'}`}>
                {tx.type === 'IN' ? '+' : '-'}{tx.amount.toLocaleString()} บาท
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}