'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';

export default function ShoppingPage() {
  const [search, setSearch] = useState('');

  // ข้อมูลจำลองสำหรับรอเชื่อม API /api/products
  const products = [
    { id: '1', name: 'ชุดโซล่าเซลล์ 15kW', price: 999999, img: '/solar1.jpg' },
    { id: '2', name: 'แผง Solar Mono 550W', price: 4200, img: '/solar2.jpg' },
    { id: '3', name: 'Inverter Huawei 10kW', price: 45000, img: '/solar3.jpg' },
    { id: '4', name: 'แบตเตอรี่ Lithium 48V', price: 32000, img: '/solar4.jpg' },
  ];

  return (
    <div className="bg-[#e0f7f7] min-h-screen">
      {/* Top Header */}
      <div className="bg-[#8be0e0] p-4 flex items-center justify-between">
        <button className="text-slate-700 text-2xl font-bold">☰</button>
      </div>

      <div className="p-4 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-full py-2 pl-4 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
          />
          <Search className="absolute right-3 top-2.5 text-slate-400 w-4 h-4" />
        </div>

        {/* Product Grid 2 คอลัมน์ */}
        <div className="grid grid-cols-2 gap-3">
          {products.map((p) => (
            <Link key={p.id} href={`/product/${p.id}`}>
              <div className="bg-[#d5e8e8] rounded-2xl p-2 shadow-sm hover:shadow-md transition">
                <div className="bg-slate-300 h-32 rounded-xl mb-2 flex items-center justify-center text-xs text-slate-500">
                  [ รูปสินค้า ]
                </div>
                <h3 className="font-semibold text-xs text-slate-800 truncate">{p.name}</h3>
                <p className="text-xs font-bold text-slate-900 mt-1">฿ {p.price.toLocaleString()}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}