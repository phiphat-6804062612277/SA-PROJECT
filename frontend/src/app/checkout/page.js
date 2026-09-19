'use client';
import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle } from 'lucide-react';
import API, { errorMessage } from '@/lib/api';
import { baht, updateStoredUser } from '@/lib/auth';
import { useAuth } from '@/lib/useAuth';
import PageHeader from '@/components/PageHeader';
import Loading from '@/components/Loading';

function CheckoutContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth({ roles: ['buyer'] });
  const ids = (params.get('ids') || '').split(',').filter(Boolean);

  const [items, setItems] = useState(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [address, setAddress] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('IDLE'); // IDLE | SUCCESS | FAIL
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [ordersCount, setOrdersCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    Promise.all([API.get('/cart'), API.get('/wallet'), API.get('/auth/me')])
      .then(([cart, wallet, me]) => {
        const all = cart.data.items;
        setItems(ids.length ? all.filter((i) => ids.includes(String(i.productId))) : all);
        setWalletBalance(wallet.data.balance ?? 0);
        setAddress(me.data.address || '');
        updateStoredUser({ ...user, ...me.data });
      })
      .catch((err) => {
        setItems([]);
        setErrorMsg(errorMessage(err));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!user || items === null) return <Loading />;

  const totalPrice = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const notEnough = walletBalance < totalPrice;
  const nextParam = encodeURIComponent(`/checkout?ids=${items.map((i) => i.productId).join(',')}`);

  const handleConfirmPay = async () => {
    if (!address.trim()) {
      setErrorMsg('กรุณากรอกที่อยู่จัดส่ง');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await API.post('/orders/checkout', {
        productIds: items.map((i) => i.productId),
        shippingAddress: address.trim(),
      });
      setOrdersCount(res.data.orders.length);
      setWalletBalance(res.data.balance);
      setPaymentStatus('SUCCESS');
    } catch (err) {
      setErrorMsg(errorMessage(err, 'เกิดข้อผิดพลาดในการชำระเงิน'));
      setPaymentStatus('FAIL');
    } finally {
      setLoading(false);
    }
  };

  if (paymentStatus === 'SUCCESS') {
    return (
      <div className="bg-[#e0f7f7] min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-4">
        <CheckCircle2 className="w-24 h-24 text-emerald-600" />
        <h2 className="text-lg font-bold text-slate-900">ชำระเงินเสร็จสิ้น<br />เงินถูกถือไว้ในระบบ Escrow</h2>
        <p className="text-xs text-slate-500">
          สร้างคำสั่งซื้อ {ordersCount} รายการ เงินจะถูกโอนให้ผู้ขายเมื่อคุณกดยืนยันรับสินค้าแล้วเท่านั้น
        </p>
        <div className="flex gap-2">
          <button onClick={() => router.push('/history')} className="bg-slate-800 text-white font-bold px-6 py-2.5 rounded-full text-sm">
            ดูคำสั่งซื้อ
          </button>
          <button onClick={() => router.push('/shopping')} className="bg-white text-slate-800 font-bold px-6 py-2.5 rounded-full text-sm">
            เลือกซื้อต่อ
          </button>
        </div>
      </div>
    );
  }

  if (paymentStatus === 'FAIL') {
    return (
      <div className="bg-[#e0f7f7] min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-4">
        <XCircle className="w-24 h-24 text-red-500" />
        <h2 className="text-lg font-bold text-slate-900">ชำระเงินไม่สำเร็จ</h2>
        <p className="text-sm font-semibold text-red-600" role="alert">{errorMsg}</p>
        <div className="bg-slate-200/80 w-full py-3 rounded-2xl text-xs font-bold text-slate-700">
          ราคาสินค้า : {baht(totalPrice)} ฿ | ยอดคงเหลือ : {baht(walletBalance)} ฿
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setPaymentStatus('IDLE'); setErrorMsg(''); }} className="bg-[#8be0e0] text-slate-900 font-bold px-6 py-2.5 rounded-full text-sm">
            ลองใหม่อีกครั้ง
          </button>
          <Link href="/cart" className="bg-white text-slate-800 font-bold px-6 py-2.5 rounded-full text-sm">
            กลับไปตะกร้า
          </Link>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-[#e0f7f7] min-h-screen flex flex-col justify-center items-center p-6 text-center">
        <p className="text-sm text-slate-600 mb-4">{errorMsg || 'ไม่มีสินค้าที่เลือกสำหรับชำระเงิน'}</p>
        <Link href="/cart" className="bg-[#8be0e0] text-slate-900 font-bold px-6 py-2 rounded-full text-sm">
          กลับไปตะกร้า
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-[#e0f7f7] min-h-screen pb-40">
      <PageHeader title="ยืนยันการชำระเงิน (Escrow)" back />
      <div className="p-4 space-y-4">
        <div className="bg-white p-4 rounded-2xl text-xs space-y-2 text-slate-700 shadow-sm">
          <p className="font-bold text-slate-900">📍 ที่อยู่จัดส่ง</p>
          <p>{user.name}{user.phone ? ` · ${user.phone}` : ''}</p>
          <textarea
            aria-label="ที่อยู่จัดส่ง"
            rows={3}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="บ้านเลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์"
            className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="bg-white p-4 rounded-2xl text-xs space-y-2 shadow-sm">
          <p className="font-bold text-slate-900">รายการสินค้า</p>
          {items.map((i) => (
            <div key={i.productId} className="flex justify-between gap-2 text-slate-700">
              <span className="flex-1 line-clamp-1">{i.product.name} × {i.quantity}</span>
              <span className="font-bold">฿ {baht(i.product.price * i.quantity)}</span>
            </div>
          ))}
        </div>

        <div className="bg-white p-4 rounded-2xl text-center space-y-2 shadow-sm">
          <p className="text-xs text-slate-600">ยอดเงินคงเหลือใน Wallet ของคุณ</p>
          <p className="text-xl font-black text-slate-900">฿ {baht(walletBalance)}</p>
          {notEnough && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-red-500">ยอดเงินไม่เพียงพอ ขาดอีก ฿ {baht(totalPrice - walletBalance)}</p>
              <Link href={`/wallet/topup?next=${nextParam}`} className="inline-block bg-slate-800 text-white font-bold px-5 py-2 rounded-full text-xs">
                เติมเงินเข้า Wallet
              </Link>
            </div>
          )}
        </div>
        {errorMsg && <p className="text-xs font-bold text-red-500 text-center" role="alert">{errorMsg}</p>}
      </div>

      <div className="fixed bottom-14 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t p-4 flex justify-between items-center z-40">
        <span className="text-xs font-bold text-slate-700">ราคารวม : <span className="text-sm font-black text-slate-900">฿ {baht(totalPrice)}</span></span>
        <button
          onClick={handleConfirmPay}
          disabled={loading || notEnough}
          className="bg-[#8be0e0] hover:bg-cyan-300 text-slate-900 font-bold px-8 py-2 rounded-full text-sm disabled:opacity-50"
        >
          {loading ? 'กำลังประมวลผล...' : 'ชำระเงิน'}
        </button>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<Loading />}>
      <CheckoutContent />
    </Suspense>
  );
}
