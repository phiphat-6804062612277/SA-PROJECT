import Link from 'next/link';
import { Star, Store } from 'lucide-react';
import { baht } from '@/lib/auth';
import ProductImage from '@/components/ProductImage';

// การ์ดสินค้าในตาราง 2 คอลัมน์ (หน้า Home / Shopping / หน้าร้าน)
//   รูปเต็มขอบการ์ด + ป้ายคะแนนบนรูป + ราคาเด่นสีธีม + แถวร้านค้า/ยอดขายด้านล่าง
export default function ProductCard({ product: p, showStore = true }) {
  const soldOut = p.stock < 1;
  const storeName = p.seller ? p.seller.storeName || p.seller.name : '';
  const hasRating = p.rating?.count > 0;

  return (
    <Link
      href={`/product/${p._id}`}
      className="group flex flex-col h-full bg-white rounded-2xl overflow-hidden shadow-sm ring-1 ring-slate-100 hover:shadow-md hover:-translate-y-0.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
    >
      <div className="relative">
        <ProductImage src={p.imageUrl} alt={p.name} className={`w-full aspect-square ${soldOut ? 'opacity-40' : 'group-hover:scale-[1.02] transition-transform'}`} iconSize={36} />
        {soldOut && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="bg-slate-900/80 text-white text-[11px] font-bold px-3 py-1 rounded-full">สินค้าหมด</span>
          </span>
        )}
        {hasRating && (
          <span className="absolute left-2 bottom-2 inline-flex items-center gap-0.5 bg-white/95 text-slate-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
            <Star size={10} className="text-amber-400 fill-amber-400" />
            {p.rating.avg.toFixed(1)}
          </span>
        )}
      </div>

      <div className="flex flex-col flex-1 p-2.5 gap-1">
        <h3 className="font-semibold text-xs text-slate-800 leading-snug line-clamp-2 text-wrap-safe min-h-[2rem]">{p.name}</h3>
        <p className="text-[15px] font-black text-cyan-800 money">฿ {baht(p.price)}</p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-[10px] text-slate-500">
          {showStore && storeName ? (
            <span className="inline-flex items-center gap-1 min-w-0">
              <Store size={11} className="shrink-0 text-slate-400" />
              <span className="truncate">{storeName}</span>
            </span>
          ) : (
            <span />
          )}
          {p.sold > 0 && <span className="shrink-0">ขายแล้ว {baht(p.sold)}</span>}
        </div>
      </div>
    </Link>
  );
}
