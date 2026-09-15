'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function CartPage() {
  const router = useRouter();
  
  // สลับ State เพื่อทดสอบหน้าตะกร้าว่างได้
  const [cartItems, setCartItems] = useState([
    { id: '1', title: 'ชุดโซล่าเซลล์ 15kW', price: 999999, checked: true }
  ]);

  const totalPrice = cartItems.reduce((sum, item) => item.checked ? sum + item.price : sum, 0);

  if (cartItems.length === 0) {
    return (
      <div className="bg-[#e0f7f7] min-h-screen flex flex-col justify-center items-center p-6 text-center">
        <div className="text-6xl mb-4">🙏</div>
        <h2 className="font-bold text-slate-800 text-base mb-1">คุณยังไม่มีสินค้าในรถเข็น</h2>
        <p className="text-xs text-slate-500 mb-6">โปรดเลือกซื้อสินค้าจากหน้าหลัก</p>
        <Link href="/shopping" className="bg-[#8be0e0] text-slate-900 font-bold px-6 py-2 rounded-full text-sm">
          ไปหน้าซื้อสินค้า
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-[#e0f7f7] min-h-screen p-4 space-y-4">
      <h1 className="font-bold text-slate-800 text-lg border-b border-cyan-300 pb-2">รถเข็นของฉัน</h1>

      <div className="space-y-3">
        {cartItems.map((item) => (
          <div key={item.id} className="bg-[#d5e8e8] p-3 rounded-2xl flex items-center gap-3">
            <input 
              type="checkbox" 
              checked={item.checked} 
              onChange={() => setCartItems(cartItems.map(i => i.id === item.id ? {...i, checked: !i.checked} : i))}
              className="w-5 h-5 accent-cyan-600 rounded" 
            />
            <div className="w-16 h-16 bg-slate-300 rounded-lg flex-shrink-0"></div>
            <div className="flex-1">
              <h3 className="font-bold text-xs text-slate-800">{item.title}</h3>
              <p className="text-xs font-black text-slate-900 mt-1">฿ {item.price.toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Checkout Bar */}
      <div className="fixed bottom-14 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t p-4 flex justify-between items-center z-40">
        <div className="text-xs font-bold text-slate-700">
          ราคารวม: <span className="text-sm font-black text-slate-900">฿ {totalPrice.toLocaleString()}</span>
        </div>
        <button 
          onClick={() => router.push('/checkout')}
          className="bg-[#8be0e0] hover:bg-cyan-300 text-slate-900 font-bold px-6 py-2 rounded-full text-sm"
        >
          ชำระเงิน
        </button>
      </div>
    </div>
  );
}