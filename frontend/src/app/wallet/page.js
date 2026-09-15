'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import API from '@/lib/api';

export default function WalletPage() {
  const [wallet, setWallet] = useState({ balance: 0, transactions: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWallet();
  }, []);

  const fetchWallet = async () => {
    try {
      const res = await API.get('/wallet');
      setWallet(res.data);
    } catch (err) {
      console.error('Error fetching wallet:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#e0f7f7] min-h-screen">
      <div className="bg-[#8be0e0] p-4"><button className="text-2xl font-bold">☰</button></div>

      <div className="p-4 space-y-4">
        <div className="bg-slate-100/80 p-5 rounded-3xl text-center shadow-sm space-y-2">
          <h2 className="font-bold text-xl text-slate-800 tracking-wider">💳 WALLET</h2>
          <div className="text-2xl font-black text-slate-900">
            {loading ? '...' : wallet.balance?.toLocaleString()} <span className="text-sm font-normal">บาท</span>
          </div>
          
          <Link href="/wallet/topup" className="inline-block bg-[#8be0e0] hover:bg-cyan-300 text-slate-800 font-bold px-6 py-2 rounded-full text-sm transition mt-2">
            เติมเงินเข้า Wallet
          </Link>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-700 border-b pb-2">รายการย้อนหลัง</h3>
          {wallet.transactions?.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">ยังไม่มีประวัติรายการ</p>
          ) : (
            wallet.transactions?.map((tx) => (
              <div key={tx._id} className="flex justify-between items-center text-xs border-b pb-2">
                <div className="flex gap-2 items-center">
                  {tx.type === 'TOPUP' || tx.type === 'REFUND' ? (
                    <ArrowDownLeft className="text-emerald-500 w-4 h-4" />
                  ) : (
                    <ArrowUpRight className="text-red-500 w-4 h-4" />
                  )}
                  <div>
                    <p className="font-bold text-slate-800">{tx.description || tx.type}</p>
                    <p className="text-[10px] text-slate-400">{new Date(tx.createdAt).toLocaleString('th-TH')}</p>
                  </div>
                </div>
                <span className={`font-bold ${tx.type === 'TOPUP' ? 'text-emerald-600' : 'text-red-500'}`}>
                  {tx.type === 'TOPUP' ? '+' : '-'}{tx.amount?.toLocaleString()} บาท
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}