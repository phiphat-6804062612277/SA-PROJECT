'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { getStoredUser, hasToken, USER_EVENT } from '@/lib/auth';

// ปุ่มตะกร้าในหัวหน้า (ผู้ซื้อ/แขกเท่านั้น) — ตะกร้าย้ายออกจากแถบเมนูล่างเพื่อให้เมนูหลักเป็น หน้าแรก / คำสั่งซื้อ / ข้อความ / Wallet / โปรไฟล์
export default function CartButton() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const read = () => {
      const role = hasToken() ? getStoredUser()?.role : 'guest';
      setShow(role === 'buyer' || role === 'guest');
    };
    read();
    window.addEventListener(USER_EVENT, read);
    return () => window.removeEventListener(USER_EVENT, read);
  }, []);
  if (!show) return null;
  return (
    <Link href="/cart" aria-label="ตะกร้าสินค้า" className="p-1.5 rounded-full bg-white/70 hover:bg-white text-slate-800">
      <ShoppingCart size={20} />
    </Link>
  );
}
