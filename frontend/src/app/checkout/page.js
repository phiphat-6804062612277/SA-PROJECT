'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, XCircle } from 'lucide-react';
import API from '@/lib/api';

export default function CheckoutPage() {
  const router = useRouter();
  const [cartItems, setCartItems] = useState([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState('IDLE'); // IDLE | SUCCESS | FAIL
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const items = JSON.parse(localStorage.getItem('cart') || '[]');
    setCartItems(items);

    API.get('/wallet/me')
      .then(res => {
        const balance = res.data.balance ?? res.data.wallet?.balance ?? 0;
        setWalletBalance(balance);
      })
      .catch(err => console.error(err));
  }, []);

  const totalPrice = cartItems.reduce((sum, item) => sum + (item.price || 0), 0);

  const handleConfirmPay = async () => {
    if (walletBalance < totalPrice) {
      setErrorMessage('ยอดเงินคงเหลือไม่เพียงพอ');
      setPaymentStatus('FAIL');
      return;
    }

    setLoading(true);
    try {
      await API.post('/escrow/checkout', {
        items: cartItems,
        totalAmount: totalPrice,
        shippingAddress: '123/45 ถนนวิภาวดีรังสิต แขวงลาดยาว เขตจตุจักร กทม. 10900'
      });

      localStorage.removeItem('cart');
      setPaymentStatus('SUCCESS');
    } catch (err) {
      console.error(err);
      setErrorMessage(err.response?.data?.message || 'เกิดข้อผิดพลาดในการชำระเงิน');
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
        <p className="text-xs text-slate-500">เงินจะถูกโอนให้ผู้ขายเมื่อคุณกดยืนยันรับสินค้าแล้วเท่านั้น</p>
        <button 
          onClick={() => router.push('/wallet')} 
          className="bg-slate-800 text-white font-bold px-8 py-2.5 rounded-full text-sm"
        >
          ตรวจสอบ Wallet
        </button>
      </div>
    );
  }

  if (paymentStatus === 'FAIL') {
    return (
      <div className="bg-[#e0f7f7] min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-4">
        <XCircle className="w-24 h-24 text-red-500" />
        <h2 className="text-lg font-bold text-slate-900">ชำระเงินไม่สำเร็จ</h2>
        <p className="text-sm font-semibold text-red-600">{errorMessage}</p>
        <div className="bg-slate-200/80 w-full py-3 rounded-2xl text-xs font-bold text-slate-700">
          ราคาสินค้า : {totalPrice.toLocaleString()} ฿ | ยอดคงเหลือ : {walletBalance.toLocaleString()} ฿
        </div>
        <button 
          onClick={() => setPaymentStatus('IDLE')} 
          className="bg-[#8be0e0] text-slate-900 font-bold px-8 py-2.5 rounded-full text-sm"
        >
          ลองใหม่อีกครั้ง
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#e0f7f7] min-h-screen p-4 space-y-4 pb-32">
      <h1 className="font-bold text-slate-800 text-center text-base border-b border-cyan-300 pb-2">ยืนยันการชำระเงิน (Escrow System)</h1>

      <div className="bg-slate-100 p-4 rounded-2xl text-xs space-y-1 text-slate-700">
        <p className="font-bold text-slate-900">📍 ที่อยู่จัดส่ง</p>
        <p>คุณสมชาย สายลม</p>
        <p>เลขที่ 123/45 ถนนวิภาวดีรังสิต แขวงลาดยาว เขตจตุจักร กทม. 10900</p>
      </div>

      <div className="bg-white p-4 rounded-2xl text-center space-y-2 shadow-sm">
        <p className="text-xs text-slate-600">ยอดเงินคงเหลือใน Wallet ของคุณ</p>
        <p className="text-xl font-black text-slate-900">฿ {walletBalance.toLocaleString()}</p>
      </div>

      <div className="fixed bottom-14 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t p-4 flex justify-between items-center z-40">
        <span className="text-xs font-bold text-slate-700">ราคารวม : <span className="text-sm font-black text-slate-900">฿ {totalPrice.toLocaleString()}</span></span>
        <button 
          onClick={handleConfirmPay}
          disabled={loading || cartItems.length === 0}
          className="bg-[#8be0e0] hover:bg-cyan-300 text-slate-900 font-bold px-8 py-2 rounded-full text-sm disabled:opacity-50"
        >
          {loading ? 'กำลังประมวลผล...' : 'ชำระเงิน'}
        </button>
      </div>
    </div>
  );
}