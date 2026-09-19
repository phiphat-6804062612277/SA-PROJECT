'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import API from '@/lib/api';
import { baht } from '@/lib/auth';
import { useAuth } from '@/lib/useAuth';
import PageHeader from '@/components/PageHeader';
import Loading from '@/components/Loading';

// ประเภทรายการที่ทำให้เงินเข้า Wallet
const INCOMING = ['TOPUP', 'REFUND', 'RECEIVE_PAYMENT'];
const LABELS = {
  TOPUP: 'เติมเงิน',
  PAYMENT: 'ชำระค่าสินค้า',
  RECEIVE_PAYMENT: 'รับเงินจากการขาย',
  REFUND: 'คืนเงิน',
  WITHDRAW: 'ถอนเงิน',
};

export default function WalletPage() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState({ balance: 0, transactions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    API.get('/wallet')
      .then((res) => setWallet(res.data))
      .catch(() => setError('ไม่สามารถโหลดข้อมูล Wallet ได้'))
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) return <Loading />;

  return (
    <div className="bg-[#e0f7f7] min-h-screen">
      <PageHeader title="Wallet" />

      <div className="p-4 space-y-4">
        <div className="bg-slate-100/80 p-5 rounded-3xl text-center shadow-sm space-y-2">
          <h2 className="font-bold text-xl text-slate-800 tracking-wider">💳 WALLET</h2>
          <div className="text-2xl font-black text-slate-900">
            {loading ? '...' : baht(wallet.balance)} <span className="text-sm font-normal">บาท</span>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-center gap-2 mt-2">
            <Link href="/wallet/topup" className="bg-[#8be0e0] hover:bg-cyan-300 text-slate-800 font-bold px-5 py-2 rounded-full text-sm transition">
              เติมเงิน
            </Link>
            {user.role === 'seller' && (
              <Link href="/wallet/withdraw" className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-5 py-2 rounded-full text-sm transition">
                ถอนเงิน
              </Link>
            )}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-700 border-b pb-2">รายการย้อนหลัง</h3>
          {!loading && wallet.transactions?.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">ยังไม่มีประวัติรายการ</p>
          ) : (
            wallet.transactions?.map((tx) => {
              const incoming = INCOMING.includes(tx.type);
              return (
                <div key={tx._id} className="flex justify-between items-center gap-2 text-xs border-b pb-2 last:border-0">
                  <div className="flex gap-2 items-center min-w-0">
                    {incoming ? (
                      <ArrowDownLeft className="text-emerald-500 w-4 h-4 shrink-0" />
                    ) : (
                      <ArrowUpRight className="text-red-500 w-4 h-4 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800">{LABELS[tx.type] || tx.type}</p>
                      {tx.description && <p className="text-[10px] text-slate-500 line-clamp-2">{tx.description}</p>}
                      <p className="text-[10px] text-slate-400">{new Date(tx.createdAt).toLocaleString('th-TH')}</p>
                    </div>
                  </div>
                  <span className={`font-bold whitespace-nowrap ${incoming ? 'text-emerald-600' : 'text-red-500'}`}>
                    {incoming ? '+' : '-'}{baht(tx.amount)} บาท
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
