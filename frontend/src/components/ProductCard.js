import Link from 'next/link';
import { baht } from '@/lib/auth';
import ProductImage from '@/components/ProductImage';
import { Star } from 'lucide-react';

// การ์ดสินค้าในตาราง 2 คอลัมน์ (หน้า Home / Shopping / หน้าร้าน)
export default function ProductCard({ product: p, showStore = true }) {
  const soldOut = p.stock < 1;
  return (
    <Link
      href={`/product/${p._id}`}
      className="block bg-white rounded-2xl p-2 shadow-sm hover:shadow-md transition h-full"
    >
      <div className="relative">
        <ProductImage src={p.imageUrl} alt={p.name} className={`w-full aspect-square rounded-xl ${soldOut ? 'opacity-50' : ''}`} iconSize={36} />
        {soldOut && (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">หมด</span>
        )}
      </div>
      <div className="mt-2 px-0.5">
        <h3 className="font-semibold text-xs text-slate-800 line-clamp-2 text-wrap-safe min-h-[2rem]">{p.name}</h3>
        <p className="text-sm font-black text-slate-900 mt-1 money">฿ {baht(p.price)}</p>
        {(p.rating?.count > 0 || p.sold > 0) && (
          <p className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
            {p.rating?.count > 0 && (
              <span className="inline-flex items-center gap-0.5 font-semibold text-slate-600">
                <Star size={10} className="text-amber-400 fill-amber-400" />
                {p.rating.avg.toFixed(1)}
              </span>
            )}
            {p.sold > 0 && <span>ขายแล้ว {baht(p.sold)} ชิ้น</span>}
          </p>
        )}
        {showStore && p.seller && (
          <p className="text-[10px] text-slate-500 truncate mt-0.5">{p.inStore !== false ? `ร้าน ${p.seller.storeName || p.seller.name}` : `ผู้ขาย ${p.seller.name}`}</p>
        )}
      </div>
    </Link>
  );
}
