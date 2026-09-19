'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingBag, Wallet, Home, ShoppingCart, User, Store } from 'lucide-react';
import { getStoredUser } from '@/lib/auth';

export default function BottomNav() {
  const pathname = usePathname();
  const [role, setRole] = useState(null);

  // อ่านบทบาทใหม่ทุกครั้งที่เปลี่ยนหน้า (เช่น เพิ่งล็อกอิน/ออกจากระบบ)
  useEffect(() => {
    setRole(getStoredUser()?.role || null);
  }, [pathname]);

  // ไม่แสดง BottomNav ในหน้า Auth
  if (['/login', '/register', '/forgot-password'].includes(pathname)) return null;

  const navItems = [
    { href: '/shopping', icon: ShoppingBag, label: 'Shopping' },
    { href: '/wallet', icon: Wallet, label: 'Wallet' },
    { href: '/', icon: Home, label: 'Home' },
    // ผู้ขายเห็นปุ่ม "ร้านค้า" แทนตะกร้า
    role === 'seller'
      ? { href: '/seller', icon: Store, label: 'Store' }
      : { href: '/cart', icon: ShoppingCart, label: 'Cart' },
    { href: '/profile', icon: User, label: 'Profile' },
  ];

  const isActive = (href) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-[#8be0e0] border-t border-cyan-300 py-2.5 px-6 flex justify-between items-center text-slate-700 z-50">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            className={`p-2 rounded-full transition-all ${
              isActive(item.href) ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
            }`}
          >
            <Icon size={22} />
          </Link>
        );
      })}
    </nav>
  );
}
