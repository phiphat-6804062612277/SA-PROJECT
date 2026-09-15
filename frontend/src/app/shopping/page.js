'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import API from '@/lib/api';

export default function ShoppingPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await API.get('/products');
      setProducts(res.data);
    } catch (err) {
      console.error('Failed to fetch products:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-[#e0f7f7] min-h-screen">
      <div className="bg-[#8be0e0] p-4 flex items-center justify-between">
        <button className="text-slate-700 text-2xl font-bold">☰</button>
      </div>

      <div className="p-4 space-y-4">
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

        {loading ? (
          <div className="text-center py-10 text-sm text-slate-500">กำลังโหลดรายการสินค้า...</div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredProducts.map((p) => (
              <Link key={p._id} href={`/product/${p._id}`}>
                <div className="bg-[#d5e8e8] rounded-2xl p-2 shadow-sm hover:shadow-md transition">
                  <img 
                    src={p.images?.[0] || '/solar-placeholder.jpg'} 
                    alt={p.name}
                    className="w-full h-32 object-cover rounded-xl mb-2"
                  />
                  <h3 className="font-semibold text-xs text-slate-800 truncate">{p.name}</h3>
                  <p className="text-xs font-bold text-slate-900 mt-1">฿ {p.price?.toLocaleString()}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}