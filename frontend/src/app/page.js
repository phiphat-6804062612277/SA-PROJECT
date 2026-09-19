'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sun, ShieldCheck, PackageCheck, Truck, Wallet } from 'lucide-react';
import API from '@/lib/api';
import { getStoredUser, baht } from '@/lib/auth';
import ProductImage from '@/components/ProductImage';

const STEPS = [
  { icon: Wallet, title: 'ชำระเงิน', desc: 'จ่ายผ่าน Wallet เงินถูกระบบถือไว้ ผู้ขายยังไม่ได้รับ' },
  { icon: Truck, title: 'ผู้ขายจัดส่ง', desc: 'ผู้ขายแจ้งเลขพัสดุ คุณติดตามสถานะได้ในหน้าคำสั่งซื้อ' },
  { icon: PackageCheck, title: 'ยืนยันรับสินค้า', desc: 'ตรวจสอบสินค้าแล้วกดยืนยัน' },
  { icon: ShieldCheck, title: 'โอนเงินให้ผู้ขาย', desc: 'ระบบปล่อยเงินให้ผู้ขายหลังคุณยืนยันเท่านั้น' },
];

export default function Home() {
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(getStoredUser());
    API.get('/products')
      .then((res) => setProducts(Array.isArray(res.data) ? res.data.slice(0, 4) : []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-[#e0f7f7] min-h-screen">
      <section className="bg-[#8be0e0] px-5 pt-10 pb-8 rounded-b-[2rem] text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-white flex items-center justify-center text-amber-500 shadow-sm">
          <Sun size={36} />
        </div>
        <h1 className="mt-3 text-2xl font-black text-slate-900 tracking-wide">Solify</h1>
        <p className="text-sm text-slate-700 mt-1">ตลาดซื้อขายอุปกรณ์ Solar Cell<br />ปลอดภัยด้วยระบบ Escrow</p>

        <div className="mt-5 flex justify-center gap-3">
          <Link href="/shopping" className="bg-slate-900 text-white font-bold px-6 py-2.5 rounded-full text-sm">
            เลือกซื้อสินค้า
          </Link>
          {!user && (
            <Link href="/login" className="bg-white text-slate-900 font-bold px-6 py-2.5 rounded-full text-sm">
              เข้าสู่ระบบ
            </Link>
          )}
          {user?.role === 'seller' && (
            <Link href="/seller" className="bg-white text-slate-900 font-bold px-6 py-2.5 rounded-full text-sm">
              ร้านค้าของฉัน
            </Link>
          )}
        </div>
        {user && <p className="text-xs text-slate-700 mt-3">สวัสดี {user.name}</p>}
      </section>

      <div className="p-4 space-y-5">
        <section>
          <div className="flex justify-between items-center mb-2">
            <h2 className="font-bold text-slate-800 text-sm">สินค้าล่าสุด</h2>
            <Link href="/shopping" className="text-xs font-bold text-cyan-700">ดูทั้งหมด</Link>
          </div>
          {loading ? (
            <p className="text-center text-xs text-slate-500 py-6">กำลังโหลด...</p>
          ) : products.length === 0 ? (
            <p className="text-center text-xs text-slate-500 py-6">ยังไม่มีสินค้าในระบบ</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {products.map((p) => (
                <Link key={p._id} href={`/product/${p._id}`} className="bg-[#d5e8e8] rounded-2xl p-2 shadow-sm hover:shadow-md transition">
                  <ProductImage src={p.imageUrl} alt={p.name} className="w-full h-28 rounded-xl" />
                  <h3 className="font-semibold text-xs text-slate-800 line-clamp-2 mt-2">{p.name}</h3>
                  <p className="text-xs font-bold text-slate-900 mt-1">฿ {baht(p.price)}</p>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white rounded-3xl p-4 shadow-sm">
          <h2 className="font-bold text-slate-800 text-sm mb-3">Escrow ปกป้องคุณอย่างไร</h2>
          <ol className="space-y-3">
            {STEPS.map(({ icon: Icon, title, desc }, i) => (
              <li key={title} className="flex gap-3 items-start">
                <span className="w-9 h-9 rounded-full bg-cyan-100 text-cyan-700 flex items-center justify-center shrink-0">
                  <Icon size={18} />
                </span>
                <div>
                  <p className="text-xs font-bold text-slate-800">{i + 1}. {title}</p>
                  <p className="text-[11px] text-slate-500 leading-snug">{desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
