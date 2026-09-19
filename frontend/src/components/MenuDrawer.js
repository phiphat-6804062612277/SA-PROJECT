'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Menu, X, House, ShoppingBag, ClipboardList, Wallet, User, Store, ShieldCheck, LogIn, UserPlus, LogOut, ShoppingCart, Scale } from 'lucide-react';
import { clearSession, getStoredUser, hasToken } from '@/lib/auth';
import Avatar from '@/components/Avatar';

// เมนูแฮมเบอร์เกอร์ (ปุ่ม ☰ มุมซ้ายบน) เลื่อนออกมาจากด้านซ้าย เมนูเปลี่ยนตามบทบาทของผู้ใช้
export default function MenuDrawer() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    setUser(hasToken() ? getStoredUser() : null);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const role = user?.role;
  const items = [
    { href: '/', icon: House, label: 'หน้าแรก' },
    { href: '/shopping', icon: ShoppingBag, label: 'สินค้าทั้งหมด' },
    ...(role === 'buyer' ? [{ href: '/cart', icon: ShoppingCart, label: 'ตะกร้าสินค้า' }, { href: '/history', icon: ClipboardList, label: 'คำสั่งซื้อของฉัน' }] : []),
    ...(role === 'seller' ? [{ href: '/seller', icon: Store, label: 'แดชบอร์ดร้านค้า' }] : []),
    ...(role === 'admin'
      ? [
          { href: '/admin', icon: ShieldCheck, label: 'จัดการระบบ (Admin)' },
          { href: '/admin/disputes', icon: Scale, label: 'จัดการข้อพิพาท' },
        ]
      : []),
    ...(user && role !== 'admin' ? [{ href: '/wallet', icon: Wallet, label: 'Wallet' }] : []),
    ...(user ? [{ href: '/profile', icon: User, label: 'โปรไฟล์' }] : []),
  ];

  const logout = () => {
    clearSession();
    setOpen(false);
    router.replace('/welcome');
  };

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="เปิดเมนู" aria-expanded={open} className="text-white/90 p-1">
        <Menu size={30} strokeWidth={3} />
      </button>

      {/* แสดงผ่าน Portal ที่ <body> — Header เป็น sticky + z-30 (สร้าง stacking context) ถ้าไม่ใช้ Portal เมนูจะถูก BottomNav (z-50) บังส่วนล่าง */}
      {open && createPortal(
        <div className="fixed inset-0 z-[90] flex justify-center">
          <div className="relative w-full max-w-md h-full">
            <button className="absolute inset-0 bg-black/40" aria-label="ปิดเมนู" onClick={() => setOpen(false)} />
            <nav className="absolute left-0 top-0 h-full w-64 bg-white shadow-xl flex flex-col" aria-label="เมนูหลัก">
              <div className="bg-[#9bdadd] px-4 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  {user && <Avatar src={user.avatarUrl} name={user.name} size={38} ring />}
                  <div className="min-w-0">
                    <p className="font-serif font-bold text-lg text-slate-900 leading-tight">SOLIFY</p>
                    <p className="text-[11px] text-slate-700 truncate max-w-[9rem]">{user ? user.name : 'ยังไม่ได้เข้าสู่ระบบ'}</p>
                  </div>
                </div>
                <button onClick={() => setOpen(false)} aria-label="ปิดเมนู" className="text-slate-700">
                  <X size={22} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-2">
                {items.map(({ href, icon: Icon, label }) => (
                  <Link key={href} href={href} onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-cyan-50">
                    <Icon size={18} className="text-cyan-600" /> {label}
                  </Link>
                ))}
              </div>

              <div className="border-t py-2">
                {user ? (
                  <button onClick={logout} className="flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold text-red-500 hover:bg-red-50">
                    <LogOut size={18} /> ออกจากระบบ
                  </button>
                ) : (
                  <>
                    <Link href="/login" onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-cyan-50">
                      <LogIn size={18} className="text-cyan-600" /> เข้าสู่ระบบ
                    </Link>
                    <Link href="/register" onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-cyan-50">
                      <UserPlus size={18} className="text-cyan-600" /> สมัครสมาชิก
                    </Link>
                  </>
                )}
              </div>
            </nav>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
