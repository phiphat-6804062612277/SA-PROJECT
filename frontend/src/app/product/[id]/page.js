'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, ShoppingCart } from 'lucide-react';
import API from '@/lib/api';

export default function ProductDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      fetchProductDetail();
    }
  }, [params.id]);

  const fetchProductDetail = async () => {
    try {
      console.log('Fetching Product ID:', params.id); // ดู ID ที่ถูกส่งมา
      const res = await API.get(`/products/${params.id}`);
      console.log('Product Data Received:', res.data);
      setProduct(res.data);
    } catch (err) {
      console.error('Failed to fetch product error:', err.response?.data || err.message);
      setProduct(null);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = () => {
    // บันทึกใส่ LocalStorage ชั่วคราว (หรือยิง API Cart)
    const currentCart = JSON.parse(localStorage.getItem('cart') || '[]');
    currentCart.push(product);
    localStorage.setItem('cart', JSON.stringify(currentCart));
    
    alert('เพิ่มสินค้าลงตะกร้าเรียบร้อย!');
    router.push('/cart');
  };

  if (loading) return <div className="p-10 text-center text-slate-500">กำลังโหลดข้อมูลสินค้า...</div>;
  if (!product) return <div className="p-10 text-center text-slate-500">ไม่พบสินค้าชิ้นนี้</div>;

  return (
    <div className="bg-white min-h-screen pb-32">
      <div className="bg-[#8be0e0] p-4">
        <button onClick={() => router.back()} className="text-slate-700">
          <ArrowLeft size={24} />
        </button>
      </div>

      <div className="bg-slate-300 h-72 relative flex items-center justify-center overflow-hidden">
        {product.images?.[0] ? (
          <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-slate-500 font-medium text-sm">[ รูปภาพสินค้า ]</span>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div className="flex justify-between items-center font-bold text-lg text-slate-900 border-b pb-2">
          <span>฿ {product.price?.toLocaleString()}</span>
          <span className="text-sm font-normal text-slate-700">Stock : {product.stock || 0}</span>
        </div>

        <h1 className="font-bold text-slate-800 text-sm leading-snug">{product.name}</h1>
        <p className="text-xs text-slate-600 leading-relaxed border-t pt-2">{product.description}</p>
      </div>

      <div className="fixed bottom-14 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t px-4 py-2.5 flex justify-between items-center z-40">
        <button onClick={() => router.back()} className="p-2 text-slate-800 hover:bg-slate-100 rounded-full">
          <ArrowLeft size={20} />
        </button>
        <button onClick={handleAddToCart} className="p-2 text-slate-800 hover:bg-slate-100 rounded-full">
          <ShoppingCart size={20} />
        </button>
        <button 
          onClick={() => {
            handleAddToCart();
            router.push('/checkout');
          }}
          className="bg-[#8be0e0] hover:bg-cyan-300 text-slate-900 font-bold px-6 py-2 rounded-full text-sm transition"
        >
          สั่งซื้อทันที
        </button>
      </div>
    </div>
  );
}