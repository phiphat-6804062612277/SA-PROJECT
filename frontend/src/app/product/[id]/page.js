'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { ShoppingCart, Minus, Plus, ChevronRight, MessageCircle } from 'lucide-react';
import API, { errorMessage } from '@/lib/api';
import { baht, getStoredUser, hasToken } from '@/lib/auth';
import ProductImage from '@/components/ProductImage';
import PageHeader from '@/components/PageHeader';
import Loading from '@/components/Loading';
import ReviewSection from '@/components/ReviewSection';
import Avatar from '@/components/Avatar';
import { RatingSummary } from '@/components/StarRating';
import { useToast } from '@/components/Toast';

export default function ProductDetailPage() {
  const router = useRouter();
  const toast = useToast();
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState('1'); // เก็บเป็นข้อความ เพื่อให้พิมพ์/ลบตัวเลขได้อิสระ
  const [user, setUser] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reviewTab, setReviewTab] = useState('product'); // product | store

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

  const stock = Math.max(product.stock, 0);
  const soldOut = stock < 1;
  const qtyNum = Math.min(Math.max(parseInt(qty, 10) || 1, 1), Math.max(stock, 1));
  const isSeller = user?.role === 'seller';
  const isAdmin = user?.role === 'admin';
  const isOwner = isSeller && String(product.sellerId) === String(user?.id);
  const canBuy = !isSeller && !isAdmin;

  // พิมพ์จำนวนได้โดยตรง: รับเฉพาะตัวเลข และไม่ให้เกินสต็อก
  const onQtyChange = (e) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 6);
    if (v !== '' && Number(v) > stock) v = String(stock);
    setQty(v);
  };
  const stepQty = (delta) => setQty(String(Math.min(Math.max(qtyNum + delta, 1), Math.max(stock, 1))));

  // เพิ่มลงตะกร้า (ต้องล็อกอินก่อน) — คืน true ถ้าสำเร็จ
  const addToCart = async () => {
    if (!hasToken()) {
      router.push(`/welcome?next=${encodeURIComponent(`/product/${id}`)}`);
      return false;
    }
    setQty(String(qtyNum));
    setBusy(true);
    try {
      await API.post('/cart', { productId: product._id, quantity: qtyNum });
      return true;
    } catch (err) {
      toast.error(errorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = async () => {
    if (await addToCart()) toast.success('เพิ่มลงตะกร้าสินค้าแล้ว', { label: 'ดูตะกร้า', href: '/cart' });
  };
  const handleBuyNow = async () => {
    if (await addToCart()) router.push(`/checkout?ids=${product._id}`);
  };

  const storeName = product.seller?.storeName || product.seller?.name;
  // สินค้า "นอกร้าน" ขายในตลาดรวมเท่านั้น จึงไม่มีลิงก์เข้าหน้าร้าน
  const inStore = product.inStore !== false;
  const Wrapper = inStore ? Link : 'div';
  const wrapperProps = inStore ? { href: `/store/${product.sellerId}` } : {};

  return (
    <div className="bg-white min-h-screen pb-32">
      <PageHeader title="รายละเอียดสินค้า" back />

      <ProductImage src={product.imageUrl} alt={product.name} className="w-full h-72" iconSize={64} />

      <div className="p-4 space-y-3">
        <div className="flex justify-between items-center font-bold text-lg text-slate-900 border-b pb-2">
          <span className="money">฿ {baht(product.price)}</span>
          <span className={`text-sm font-normal ${soldOut ? 'text-red-500' : 'text-slate-700'}`}>
            {soldOut ? 'สินค้าหมด' : `Stock : ${stock}`}
          </span>
        </div>

        <h2 className="font-bold text-slate-800 text-sm leading-snug text-wrap-safe">{product.name}</h2>
        <div className="flex items-center justify-between gap-2">
          <RatingSummary rating={product.rating} />
          {product.sold > 0 && <span className="text-[11px] text-slate-500 shrink-0">ขายแล้ว {baht(product.sold)} ชิ้น</span>}
        </div>

        {product.seller && (
          <Wrapper {...wrapperProps} className="flex items-center gap-3 bg-slate-50 hover:bg-cyan-50 rounded-2xl p-3 transition">
            <Avatar src={product.seller.logoUrl} name={storeName} size={44} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-800 truncate">{product.inStore !== false ? `ร้าน ${storeName}` : `ผู้ขาย ${product.seller.name}`}</p>
              <RatingSummary rating={product.sellerRating} emptyText="ร้านใหม่ ยังไม่มีรีวิว" />
            </div>
            {inStore && (
              <span className="flex items-center text-xs font-bold text-cyan-700 shrink-0">
                เข้าชมร้าน <ChevronRight size={14} />
              </span>
            )}
          </Wrapper>
        )}

        {product.seller && canBuy && (
          <Link
            href={`/chat/new?sellerId=${product.sellerId}&productId=${product._id}`}
            className="flex items-center justify-center gap-2 border border-cyan-300 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 text-xs font-bold py-2.5 rounded-full"
          >
            <MessageCircle size={16} /> แชตกับร้านค้าเรื่องสินค้านี้
          </Link>
        )}

        <div className="border-t pt-3 space-y-1">
          <h3 className="text-xs font-bold text-slate-700">รายละเอียดสินค้า</h3>
          <p className="text-xs text-slate-600 leading-relaxed text-wrap-safe">{product.description || 'ไม่มีคำอธิบายสินค้า'}</p>
        </div>

        <div className="border-t pt-3 space-y-3">
          <div className="flex border-b border-cyan-200 text-sm font-semibold" role="tablist">
            {[
              ['product', `รีวิวสินค้า (${product.rating?.count || 0})`],
              ['store', `รีวิวร้านค้า (${product.sellerRating?.count || 0})`],
            ].map(([key, label]) => (
              <button key={key} role="tab" aria-selected={reviewTab === key} onClick={() => setReviewTab(key)} className={`flex-1 pb-2 ${reviewTab === key ? 'border-b-2 border-slate-800 text-slate-900' : 'text-slate-400'}`}>
                {label}
              </button>
            ))}
          </div>
          {reviewTab === 'product' ? (
            <ReviewSection key={`product-${id}`} endpoint={`/reviews/product/${id}`} title="รีวิวจากผู้ซื้อสินค้านี้" emptyText="ยังไม่มีรีวิวสำหรับสินค้านี้" />
          ) : (
            <ReviewSection key={`store-${product.sellerId}`} endpoint={`/reviews/seller/${product.sellerId}`} title="รีวิวร้านค้า" emptyText="ร้านนี้ยังไม่มีรีวิว" showGallery={false} />
          )}
        </div>
      </div>

      <div className="fixed bottom-[68px] left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t px-4 py-2.5 z-40">
        {isOwner ? (
          <Link href={`/seller/products/${product._id}`} className="block text-center bg-[#9bdadd] font-bold py-2 rounded-full text-sm">
            แก้ไขสินค้านี้
          </Link>
        ) : !canBuy ? (
          <p className="text-center text-xs text-slate-500 py-2">บัญชีผู้ขาย/ผู้ดูแลระบบไม่สามารถสั่งซื้อสินค้าได้</p>
        ) : (
          <div className="space-y-2">
            {!soldOut && (
              <div className="flex items-center justify-between text-xs text-slate-600">
                <label htmlFor="qty" className="font-bold">จำนวน</label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-slate-100 rounded-full">
                    <button aria-label="ลดจำนวน" disabled={qtyNum <= 1} onClick={() => stepQty(-1)} className="p-2 disabled:opacity-30">
                      <Minus size={16} />
                    </button>
                    <input
                      id="qty"
                      value={qty}
                      onChange={onQtyChange}
                      onBlur={() => setQty(String(qtyNum))}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      aria-label="จำนวนที่ต้องการซื้อ"
                      className="w-14 text-center bg-transparent text-sm font-bold text-slate-900 outline-none"
                    />
                    <button aria-label="เพิ่มจำนวน" disabled={qtyNum >= stock} onClick={() => stepQty(1)} className="p-2 disabled:opacity-30">
                      <Plus size={16} />
                    </button>
                  </div>
                  <span className="text-slate-400">สูงสุด {stock}</span>
                </div>
                <span className="font-black text-slate-900 text-sm money">฿ {baht(product.price * qtyNum)}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
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
                className="flex-1 bg-[#9bdadd] hover:bg-cyan-300 text-slate-900 font-bold px-4 py-2.5 rounded-full text-sm transition disabled:opacity-40"
              >
                {soldOut ? 'สินค้าหมด' : 'สั่งซื้อทันที'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
