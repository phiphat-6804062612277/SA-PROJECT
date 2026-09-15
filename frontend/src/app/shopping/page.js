'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import API from '@/lib/api';

export default function ShoppingPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await API.get('/products');
      console.log('Products Data:', res.data); // ดูข้อมูลที่ดึงได้ใน Console (F12)
      setProducts(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch products:', err);
      setError('ไม่สามารถโหลดรายการสินค้าได้');
    } finally {
      setLoading(false);
    }
  };

  // ดึงชื่อสินค้าแบบยืดหยุ่น (รองรับทั้ง name และ title)
  const filteredProducts = products.filter((p) => {
    const productName = p.name || p.title || '';
    return productName.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="bg-[#e0f7f7] min-h-screen pb-20">
      {/* Header */}
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
            className="w-full bg-white border border-slate-300 rounded-full py-2 pl-4 pr-10 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
          />
          <Search className="absolute right-3 top-2.5 text-slate-400 w-4 h-4" />
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="text-center py-12 text-sm text-slate-500">กำลังโหลดรายการสินค้า...</div>
        ) : error ? (
          <div className="text-center py-12 text-sm text-red-500">{error}</div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12 text-sm text-slate-500">
            ยังไม่มีสินค้าในระบบ
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredProducts.map((p) => {
              const productId = p._id || p.id;
              const productName = p.name || p.title || 'สินค้าไม่มีชื่อ';
              const imageUrl = p.images?.[0] || p.image || '/solar-placeholder.jpg';

              return (
                <Link key={productId} href={`/product/${productId}`}>
                  <div className="bg-[#d5e8e8] rounded-2xl p-2 shadow-sm hover:shadow-md transition flex flex-col justify-between h-full">
                    <div className="bg-slate-300 w-full h-32 rounded-xl overflow-hidden flex items-center justify-center">
                      {p.images?.[0] || p.image ? (
                        <img 
                          src={imageUrl} 
                          alt={productName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-slate-500 text-xs">[ รูปสินค้า ]</span>
                      )}
                    </div>
                    <div className="mt-2">
                      <h3 className="font-semibold text-xs text-slate-800 line-clamp-2">{productName}</h3>
                      <p className="text-xs font-bold text-slate-900 mt-1">
                        ฿ {p.price ? p.price.toLocaleString() : '0'}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}