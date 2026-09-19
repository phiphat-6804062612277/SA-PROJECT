'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Minus, Plus, Trash2 } from 'lucide-react';
import API, { errorMessage } from '@/lib/api';
import { baht } from '@/lib/auth';
import { useAuth } from '@/lib/useAuth';
import ProductImage from '@/components/ProductImage';
import PageHeader from '@/components/PageHeader';
import Loading from '@/components/Loading';
import Notice from '@/components/Notice';

export default function CartPage() {
  const router = useRouter();
  const { user } = useAuth({ roles: ['buyer'] });
  const [items, setItems] = useState(null); // null = กำลังโหลด
  const [selected, setSelected] = useState(new Set());
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    API.get('/cart')
      .then((res) => {
        setItems(res.data.items);
        setSelected(new Set(res.data.items.map((i) => i.productId))); // ติ๊กเลือกทุกชิ้นเป็นค่าเริ่มต้น
      })
      .catch((err) => {
        setItems([]);
        setError(errorMessage(err));
      });
  }, [user]);

  const applyCart = (data) => {
    setItems(data.items);
    setSelected((prev) => new Set(data.items.map((i) => i.productId).filter((id) => prev.has(id))));
  };

  const changeQty = async (item, qty) => {
    setError('');
    try {
      applyCart((await API.put(`/cart/${item.productId}`, { quantity: qty })).data);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const remove = async (item) => {
    setError('');
    try {
      applyCart((await API.delete(`/cart/${item.productId}`)).data);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const toggle = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  if (!user || items === null) return <Loading />;

  if (items.length === 0) {
    return (
      <div className="bg-[#e0f7f7] min-h-screen flex flex-col justify-center items-center p-6 text-center">
        <div className="text-6xl mb-4">🛒</div>
        <h2 className="font-bold text-slate-800 text-base mb-1">คุณยังไม่มีสินค้าในรถเข็น</h2>
        <p className="text-xs text-slate-500 mb-6">โปรดเลือกซื้อสินค้าจากหน้าร้านค้า</p>
        <Link href="/shopping" className="bg-[#9bdadd] text-slate-900 font-bold px-6 py-2 rounded-full text-sm">
          ไปหน้าซื้อสินค้า
        </Link>
      </div>
    );
  }

  const chosen = items.filter((i) => selected.has(i.productId));
  const totalPrice = chosen.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

  return (
    <div className="bg-[#e0f7f7] min-h-screen pb-40">
      <PageHeader title="รถเข็นของฉัน" />
      <div className="p-4 space-y-3">
        <Notice type="error">{error}</Notice>

        {items.map((item) => {
          const p = item.product;
          return (
            <div key={item.productId} className="bg-[#d5e8e8] p-3 rounded-2xl flex items-center gap-3">
              <input
                type="checkbox"
                aria-label={`เลือก ${p.name}`}
                checked={selected.has(item.productId)}
                onChange={() => toggle(item.productId)}
                className="w-5 h-5 accent-cyan-600 rounded shrink-0"
              />
              <Link href={`/product/${item.productId}`} className="shrink-0">
                <ProductImage src={p.imageUrl} alt={p.name} className="w-16 h-16 rounded-lg" iconSize={22} />
              </Link>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-xs text-slate-800 line-clamp-2 text-wrap-safe">{p.name}</h3>
                <p className="text-xs font-black text-slate-900 mt-1 money">฿ {baht(p.price)}</p>
                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center gap-1 bg-white rounded-full">
                    <button aria-label="ลดจำนวน" disabled={item.quantity <= 1} onClick={() => changeQty(item, item.quantity - 1)} className="p-1.5 disabled:opacity-30">
                      <Minus size={13} />
                    </button>
                    <span className="w-5 text-center text-xs font-bold">{item.quantity}</span>
                    <button aria-label="เพิ่มจำนวน" disabled={item.quantity >= p.stock} onClick={() => changeQty(item, item.quantity + 1)} className="p-1.5 disabled:opacity-30">
                      <Plus size={13} />
                    </button>
                  </div>
                  <button aria-label={`ลบ ${p.name} ออกจากตะกร้า`} onClick={() => remove(item)} className="p-1.5 text-red-500">
                    <Trash2 size={16} />
                  </button>
                </div>
                {p.stock < item.quantity && <p className="text-[10px] text-red-500 font-bold mt-1">สต็อกไม่พอ (เหลือ {p.stock})</p>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="fixed bottom-[68px] left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t p-4 flex justify-between items-center z-40">
        <div className="text-xs font-bold text-slate-700">
          ราคารวม ({chosen.length} รายการ): <span className="text-sm font-black text-slate-900 money">฿ {baht(totalPrice)}</span>
        </div>
        <button
          disabled={chosen.length === 0}
          onClick={() => router.push(`/checkout?ids=${chosen.map((i) => i.productId).join(',')}`)}
          className="bg-[#9bdadd] hover:bg-cyan-300 text-slate-900 font-bold px-6 py-2 rounded-full text-sm disabled:opacity-40"
        >
          ชำระเงิน
        </button>
      </div>
    </div>
  );
}
