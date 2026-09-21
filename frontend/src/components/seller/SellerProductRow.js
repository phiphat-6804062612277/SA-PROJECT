'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Pencil, Trash2 } from 'lucide-react';
import API, { errorMessage } from '@/lib/api';
import { baht } from '@/lib/auth';
import ProductImage from '@/components/ProductImage';
import { useToast } from '@/components/Toast';

export const LOW_STOCK = 5;

// แถวสินค้าในแดชบอร์ดผู้ขาย: เห็นราคา/สต็อก แก้ไขและลบได้
export default function SellerProductRow({ product: p, onChanged }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const run = async (fn, okText) => {
    setBusy(true);
    try {
      await fn();
      toast.success(okText);
      await onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (!window.confirm(`ลบสินค้า "${p.name}" ออกจากร้าน?`)) return;
    run(() => API.delete(`/products/${p._id}`), 'ลบสินค้าเรียบร้อยแล้ว');
  };

  return (
    <div className="bg-white p-3 rounded-2xl shadow-sm space-y-2">
      <div className="flex gap-3 items-center">
        <ProductImage src={p.imageUrl} alt={p.name} className="w-16 h-16 rounded-lg shrink-0" iconSize={22} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-800 line-clamp-2 text-wrap-safe">{p.name}</p>
          <p className="text-sm font-black text-slate-900 mt-0.5 money">฿ {baht(p.price)}</p>
          <p className={`text-[11px] font-bold ${p.stock < 1 ? 'text-red-500' : p.stock <= LOW_STOCK ? 'text-amber-600' : 'text-slate-500'}`}>
            {p.stock < 1 ? 'สินค้าหมด' : p.stock <= LOW_STOCK ? `เหลือน้อย ${p.stock} ชิ้น` : `สต็อก ${p.stock} ชิ้น`}
          </p>
          {p.suspended && <p className="text-[10px] font-bold text-red-500">ถูกระงับการขาย</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Link href={`/seller/products/${p._id}`} aria-label={`แก้ไข ${p.name}`} className="p-2 bg-slate-100 rounded-full text-slate-700 hover:bg-slate-200">
            <Pencil size={15} />
          </Link>
          <button disabled={busy} onClick={remove} aria-label={`ลบ ${p.name}`} className="p-2 bg-red-50 rounded-full text-red-500 hover:bg-red-100 disabled:opacity-40">
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
