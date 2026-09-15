'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingBag, Wallet, Home, ShoppingCart, User } from 'lucide-react';

export default function BottomNav() {
  const pathname = usePathname();

  // ไม่แสดง BottomNav ในหน้า Auth
  if (['/login', '/register', '/forgot-password'].includes(pathname)) {
    return null;
  }

  const navItems = [
    { href: '/shopping', icon: ShoppingBag, label: 'Shopping' },
    { href: '/wallet', icon: Wallet, label: 'Wallet' },
    { href: '/', icon: Home, label: 'Home' },
    { href: '/cart', icon: ShoppingCart, label: 'Cart' },
    { href: '/profile', icon: User, label: 'Profile' },
  ];

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-[#8be0e0] border-t border-cyan-300 py-2.5 px-6 flex justify-between items-center text-slate-700 z-50">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`p-2 rounded-full transition-all ${
              isActive ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
            }`}
          >
            <Icon size={22} />
          </Link>
        );
      })}
    </div>
  );
}