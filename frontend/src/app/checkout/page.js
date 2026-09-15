'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, XCircle } from 'lucide-react';

export default function CheckoutPage() {
  const router = useRouter();
  const [paymentStatus, setPaymentStatus] = useState('IDLE'); // IDLE | SUCCESS | FAIL
  
  const walletBalance = 1000000; // สมมุติยอดเงินใน Wallet (รอเชื่อม GET /api/wallet)
  const itemPrice = 999999;

  const handleConfirmPay = () => {
    if (walletBalance >= itemPrice) {
      setPaymentStatus('SUCCESS');
    } else {
      setPaymentStatus('FAIL');
    }
  };

  // 1. หน้าชำระเงินสำเร็จ (Success Payment)
  if (paymentStatus === 'SUCCESS') {
    return (
      <div className="bg-[#e0f7f7] min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-4">
        <CheckCircle2 className="w-24 h-24 text-slate-900" />
        <h2 className="text-lg font-bold text-slate-900">ชำระเงินเสร็จสิ้น<br />เงินถูกถือไว้ในระบบ Escrow</h2>
        <div className="bg-slate-200/60 w-full py-3 rounded-full text-xs font-bold text-slate-700">
          ยอดเงินคงเหลือ : {(walletBalance - itemPrice).toLocaleString()} ฿
        </div>
        <button 
          onClick={() => router.push('/history')} 
          className="bg-slate-300 hover:bg-slate-400 text-slate-900 font-bold px-8 py-2.5 rounded-full text-sm"
        >
          ติดตามสถานะสินค้า
        </button>
      </div>
    );
  }

  // 2. หน้าชำระเงินไม่สำเร็จ (Fail Payment)
  if (paymentStatus === 'FAIL') {
    return (
      <div className="bg-[#e0f7f7] min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-4">
        <XCircle className="w-24 h-24 text-slate-900" />
        <h2 className="text-lg font-bold text-slate-900">ยอดเงินในบัญชีไม่เพียงพอ<br />กรุณาเติมเงิน</h2>
        <div className="bg-slate-200/60 w-full py-3 rounded-full text-xs font-bold text-slate-700">
          ราคา : {itemPrice.toLocaleString()} ฿ | ยอดคงเหลือ : {walletBalance.toLocaleString()} ฿
        </div>
        <button 
          onClick={() => router.push('/wallet/topup')} 
          className="bg-slate-300 hover:bg-slate-400 text-slate-900 font-bold px-8 py-2.5 rounded-full text-sm"
        >
          กรุณาเติมเงิน
        </button>
      </div>
    );
  }

  // 3. หน้ากดยืนยันการชำระเงิน (Confirm Pay)
  return (
    <div className="bg-[#e0f7f7] min-h-screen p-4 space-y-4">
      <h1 className="font-bold text-slate-800 text-center text-base">Confirm Payment</h1>

      {/* Address Card */}
      <div className="bg-slate-200/80 p-4 rounded-2xl text-xs space-y-1 text-slate-700">
        <p className="font-bold text-slate-900">📍 ที่อยู่จัดส่ง</p>
        <p>คุณสมชาย สายลม</p>
        <p>เลขที่ 123/45 ถนนวิภาวดีรังสิต แขวงลาดยาว เขตจตุจักร กทม. 10900</p>
      </div>

      {/* Balance Box */}
      <div className="bg-slate-200/80 p-4 rounded-2xl text-center space-y-2">
        <p className="text-xs text-slate-600">ยอดเงินคงเหลือใน Wallet</p>
        <p className="text-xl font-black text-slate-900">฿ {walletBalance.toLocaleString()}</p>
      </div>

      {/* Submit Bar */}
      <div className="fixed bottom-14 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t p-4 flex justify-between items-center z-40">
        <span className="text-xs font-bold text-slate-700">ราคารวม : ฿ {itemPrice.toLocaleString()}</span>
        <button 
          onClick={handleConfirmPay}
          className="bg-[#8be0e0] hover:bg-cyan-300 text-slate-900 font-bold px-8 py-2 rounded-full text-sm"
        >
          ชำระเงิน
        </button>
      </div>
    </div>
  );
}