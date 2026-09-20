'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getStoredUser, hasToken, USER_EVENT } from '@/lib/auth';
import { navFor } from '@/lib/nav';
import NotificationBadge from '@/components/NotificationBadge';
import { useNotifications } from '@/components/NotificationProvider';

const HIDE_ON = ['/welcome', '/login', '/register', '/forgot-password', '/suspended'];

// แถบเมนูล่าง: 5 เมนูตามบทบาท (Buyer / Seller / Admin) มีป้ายชื่อใต้ไอคอน และ Badge (!) ที่เมนูที่มีงานค้าง
// ความสูงคงที่ 68px — หน้าอื่นที่ลอยเหนือแถบนี้ (ห้องแชต / แถบซื้อสินค้า) ใช้ bottom-[68px]
export default function BottomNav() {
  const pathname = usePathname();
  const { countOf } = useNotifications();
  const [user, setUser] = useState(undefined); // undefined = ยังไม่อ่านจาก localStorage (กันเมนูของแขกวาบก่อนโหลดเสร็จ)

  // อ่านผู้ใช้ใหม่ทุกครั้งที่เปลี่ยนหน้า / เมื่อมีการล็อกอิน-ออกจากระบบ-แก้โปรไฟล์
  useEffect(() => {
    const read = () => setUser(hasToken() ? getStoredUser() : null);
    read();
    window.addEventListener(USER_EVENT, read);
    return () => window.removeEventListener(USER_EVENT, read);
  }, [pathname]);

  // ไม่แสดง BottomNav ในหน้า Auth / หน้าบัญชีถูกระงับ
  if (HIDE_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  const items = user === undefined ? [] : navFor(user);

  return (
    <nav aria-label="เมนูหลัก" className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md h-[68px] bg-[#9bdadd] shadow-[0_-4px_14px_rgba(0,0,0,0.08)] z-50 flex items-stretch px-1">
      {items.map(({ href, label, icon: Icon, match, badge, badgeLabel }) => {
        const active = match(pathname);
        const count = badge ? countOf(...badge) : 0;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className="flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 rounded-xl"
          >
            <span
              className={`relative flex items-center justify-center h-7 w-12 rounded-full transition ${
                active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-700'
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.4 : 2} />
              <NotificationBadge count={count} label={badgeLabel} />
            </span>
            <span className={`text-[10px] leading-none truncate max-w-full px-0.5 ${active ? 'font-black text-slate-900' : 'font-semibold text-slate-700'}`}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
