'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { ShoppingCart, Minus, Plus, Store } from 'lucide-react';
import API, { errorMessage } from '@/lib/api';
import { baht, getStoredUser, hasToken } from '@/lib/auth';
import ProductImage from '@/components/ProductImage';
import PageHeader from '@/components/PageHeader';
import Loading from '@/components/Loading';
import Notice from '@/components/Notice';

export default function ProductDetailPage() {
  const router = useRouter();
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [user, setUser] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ type: 'info', text: '' });

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  useEffect(() => {
    if (!id) return;
    API.get(`/products/${id}`)
      .then((res) => setProduct(res.data))
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Loading text="กำลังโหลดข้อมูลสินค้า..." />;
  if (!product) {
    return (
      <div>
        <PageHeader title="ไม่พบสินค้า" back />
        <div className="p-10 text-center text-slate-500 text-sm">ไม่พบสินค้าชิ้นนี้ หรือสินค้าถูกนำออกจากร้านแล้ว</div>
      </div>
    );
  }

  const isSeller = user?.role === 'seller';
  const isOwner = isSeller && String(product.sellerId) === String(user?.id);
  const soldOut = product.stock < 1;

  // เพิ่มลงตะกร้า (ต้องล็อกอินก่อน) — คืน true ถ้าสำเร็จ
  const addToCart = async () => {
    if (!hasToken()) {
      router.push(`/login?next=${encodeURIComponent(`/product/${id}`)}`);
      return false;
    }
    setBusy(true);
    setMessage({ type: 'info', text: '' });
    try {
      await API.post('/cart', { productId: product._id, quantity: qty });
      return true;
    } catch (err) {
      setMessage({ type: 'error', text: errorMessage(err) });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = async () => {
    if (await addToCart()) setMessage({ type: 'success', text: 'เพิ่มสินค้าลงตะกร้าแล้ว' });
  };
  const handleBuyNow = async () => {
    if (await addToCart()) router.push(`/checkout?ids=${product._id}`);
  };

  return (
    <div className="bg-white min-h-screen pb-32">
      <PageHeader title="รายละเอียดสินค้า" back />

      <ProductImage src={product.imageUrl} alt={product.name} className="w-full h-72" iconSize={64} />

      <div className="p-4 space-y-3">
        <div className="flex justify-between items-center font-bold text-lg text-slate-900 border-b pb-2">
          <span>฿ {baht(product.price)}</span>
          <span className={`text-sm font-normal ${soldOut ? 'text-red-500' : 'text-slate-700'}`}>
            {soldOut ? 'สินค้าหมด' : `Stock : ${product.stock}`}
          </span>
        </div>

        <h2 className="font-bold text-slate-800 text-sm leading-snug">{product.name}</h2>
        {product.seller?.name && (
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <Store size={13} /> ร้าน {product.seller.name}
          </p>
        )}
        <p className="text-xs text-slate-600 leading-relaxed border-t pt-2 whitespace-pre-line">
          {product.description || 'ไม่มีคำอธิบายสินค้า'}
        </p>

        <Notice type={message.type}>{message.text}</Notice>
      </div>

      <div className="fixed bottom-14 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t px-4 py-2.5 z-40">
        {isOwner ? (
          <Link href={`/seller/products/${product._id}`} className="block text-center bg-[#8be0e0] font-bold py-2 rounded-full text-sm">
            แก้ไขสินค้านี้
          </Link>
        ) : isSeller ? (
          <p className="text-center text-xs text-slate-500 py-2">บัญชีผู้ขายไม่สามารถสั่งซื้อสินค้าได้</p>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 bg-slate-100 rounded-full">
              <button aria-label="ลดจำนวน" disabled={qty <= 1} onClick={() => setQty(qty - 1)} className="p-2 disabled:opacity-30">
                <Minus size={16} />
              </button>
              <span className="w-6 text-center text-sm font-bold" aria-live="polite">{qty}</span>
              <button aria-label="เพิ่มจำนวน" disabled={qty >= product.stock} onClick={() => setQty(qty + 1)} className="p-2 disabled:opacity-30">
                <Plus size={16} />
              </button>
            </div>
            <button
              onClick={handleAdd}
              disabled={busy || soldOut}
              aria-label="เพิ่มลงตะกร้า"
              className="p-2.5 text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-full disabled:opacity-40"
            >
              <ShoppingCart size={20} />
            </button>
            <button
              onClick={handleBuyNow}
              disabled={busy || soldOut}
              className="flex-1 bg-[#8be0e0] hover:bg-cyan-300 text-slate-900 font-bold px-4 py-2 rounded-full text-sm transition disabled:opacity-40"
            >
              สั่งซื้อทันที
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
