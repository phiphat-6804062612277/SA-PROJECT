'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingBag, Wallet, House, ShoppingCart, User, Store, ShieldCheck, Scale } from 'lucide-react';
import { getStoredUser } from '@/lib/auth';
import NotificationBadge from '@/components/NotificationBadge';
import { useNotifications } from '@/components/NotificationProvider';

const HIDE_ON = ['/welcome', '/login', '/register', '/forgot-password', '/suspended'];

export default function BottomNav() {
  const pathname = usePathname();
  const [role, setRole] = useState(null);
  const { total } = useNotifications();

  // อ่านบทบาทใหม่ทุกครั้งที่เปลี่ยนหน้า (เช่น เพิ่งล็อกอิน/ออกจากระบบ)
  useEffect(() => {
    setRole(getStoredUser()?.role || null);
  }, [pathname]);

  // ไม่แสดง BottomNav ในหน้า Auth
  if (HIDE_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  // ผู้ขายเห็นปุ่ม "ร้านค้า" / Admin เห็นปุ่ม "จัดการระบบ" แทนตะกร้า
  const third =
    role === 'seller'
      ? { href: '/seller', icon: Store, label: 'Store' }
      : role === 'admin'
        ? { href: '/admin', icon: ShieldCheck, label: 'Admin' }
        : { href: '/cart', icon: ShoppingCart, label: 'Cart' };

  const navItems = [
    { href: '/shopping', icon: ShoppingBag, label: 'Shopping' },
    // Admin ไม่มี Wallet — แทนด้วยเมนูจัดการข้อพิพาท
    role === 'admin' ? { href: '/admin/disputes', icon: Scale, label: 'Disputes' } : { href: '/wallet', icon: Wallet, label: 'Wallet' },
    { href: '/', icon: House, label: 'Home' },
    third,
    { href: '/profile', icon: User, label: 'Profile' },
  ];

  // Badge ! แสดงที่แท็บที่มีงานรออยู่: ผู้ซื้อ = โปรไฟล์ (→ คำสั่งซื้อ), ผู้ขาย = ร้านค้า, Admin = ข้อพิพาท
  const badgeHref = role === 'seller' ? '/seller' : role === 'admin' ? '/admin/disputes' : role === 'buyer' ? '/profile' : null;

  // /admin (แดชบอร์ด) ไม่ต้อง active ซ้อนกับ /admin/disputes
  const isActive = (href) => {
    if (href === '/') return pathname === '/';
    if (href === '/admin') return pathname === '/admin';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-[#9bdadd] py-3 px-5 flex justify-between items-center z-50">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            aria-current={active ? 'page' : undefined}
            className={`relative w-11 h-11 rounded-full flex items-center justify-center transition ${
              active ? 'bg-white text-slate-900 shadow ring-2 ring-white' : 'bg-[#c9f3f5] text-slate-800 hover:bg-white'
            }`}
          >
            <Icon size={20} />
            {item.href === badgeHref && <NotificationBadge count={total} />}
          </Link>
        );
      })}
    </nav>
  );
}
