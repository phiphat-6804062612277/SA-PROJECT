'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ShoppingCart } from 'lucide-react';

export default function ProductDetailPage({ params }) {
  const router = useRouter();
  
  // สมมุติข้อมูลสินค้า (พร้อมเชื่อม GET /api/products/:id)
  const product = {
    id: params.id,
    title: 'ชุดโซล่าเซลล์ 15kW | Inverter Huawei | ระบบไฟ 3 เฟส พร้อมติดตั้งครบชุด',
    description: 'โซล่าเซลล์ 15kW สำหรับไฟ 3 เฟส เหมาะกับบ้านหรือโรงงานที่ใช้ไฟสูง ใช้ Inverter Huawei รุ่น M2 และแผง Tier1 ประหยัดค่าไฟได้เดือนละ 8,000–10,000 บาท',
    price: 999999,
    stock: 20,
  };

  const handleAddToCart = () => {
    // เก็บลง Cart หรือยิง API
    alert('เพิ่มสินค้าลงตะกร้าเรียบร้อย!');
    router.push('/cart');
  };

  return (
    <div className="bg-white min-h-screen pb-32">
      {/* Top Header */}
      <div className="bg-[#8be0e0] p-4">
        <button onClick={() => router.back()} className="text-slate-700">
          <ArrowLeft size={24} />
        </button>
      </div>

      {/* Main Image */}
      <div className="bg-slate-300 h-72 relative flex items-center justify-center">
        <span className="text-slate-500 font-medium text-sm">[ รูปภาพสินค้า ]</span>
        <span className="absolute bottom-3 right-3 bg-slate-800/60 text-white text-xs px-2.5 py-1 rounded-full">
          1/11
        </span>
      </div>

      {/* Thumbnails */}
      <div className="grid grid-cols-5 gap-2 p-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-slate-200 aspect-square rounded-md border border-slate-300"></div>
        ))}
      </div>

      {/* Info & Price */}
      <div className="px-4 space-y-3">
        <div className="flex justify-between items-center font-bold text-lg text-slate-900 border-b pb-2">
          <span>฿ {product.price.toLocaleString()}</span>
          <span className="text-sm font-normal text-slate-700">Stock : {product.stock}</span>
        </div>

        <h1 className="font-bold text-slate-800 text-sm leading-snug">{product.title}</h1>
        <p className="text-xs text-slate-600 leading-relaxed border-t pt-2">{product.description}</p>
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-14 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t px-4 py-2.5 flex justify-between items-center z-40">
        <button onClick={() => router.back()} className="p-2 text-slate-800 hover:bg-slate-100 rounded-full">
          <ArrowLeft size={20} />
        </button>
        <button onClick={handleAddToCart} className="p-2 text-slate-800 hover:bg-slate-100 rounded-full">
          <ShoppingCart size={20} />
        </button>
        <button 
          onClick={() => router.push('/checkout')}
          className="bg-[#8be0e0] hover:bg-cyan-300 text-slate-900 font-bold px-6 py-2 rounded-full text-sm transition"
        >
          ฿ {product.price.toLocaleString()}
        </button>
      </div>
    </div>
  );
}