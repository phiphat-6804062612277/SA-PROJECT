'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X, LogIn, UserPlus, LogOut } from 'lucide-react';
import { getStoredUser, hasToken, USER_EVENT } from '@/lib/auth';
import { signOut } from '@/lib/api';
import { extraMenuFor, navFor } from '@/lib/nav';
import Avatar from '@/components/Avatar';
import NotificationBadge from '@/components/NotificationBadge';
import { useNotifications } from '@/components/NotificationProvider';

const ROLE_TEXT = { buyer: 'ผู้ซื้อ', seller: 'ผู้ขาย', admin: 'ผู้ดูแลระบบ' };

const Row = ({ href, icon: Icon, label, active, badge, badgeLabel, onNavigate }) => (
  <Link
    href={href}
    onClick={onNavigate}
    aria-current={active ? 'page' : undefined}
    className={`flex items-center gap-3 px-4 py-3 text-sm font-semibold hover:bg-cyan-50 ${active ? 'bg-cyan-50 text-slate-900' : 'text-slate-700'}`}
  >
    <span className="relative">
      <Icon size={18} className="text-cyan-600" />
      <NotificationBadge count={badge} label={badgeLabel} />
    </span>
    <span className="flex-1">{label}</span>
  </Link>
);

// เมนูแฮมเบอร์เกอร์ (ปุ่ม ☰ มุมซ้ายบน) เลื่อนออกมาจากด้านซ้าย — แยกหมวดตามบทบาทเหมือนแถบเมนูล่าง + เมนูเสริม
export default function MenuDrawer() {
  const router = useRouter();
  const pathname = usePathname();
  const { countOf } = useNotifications();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const read = () => setUser(hasToken() ? getStoredUser() : null);
    read();
    window.addEventListener(USER_EVENT, read);
    return () => window.removeEventListener(USER_EVENT, read);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const main = navFor(user).filter((i) => user || i.href !== '/login'); // แขกมีปุ่มเข้าสู่ระบบ/สมัครสมาชิกด้านล่างอยู่แล้ว
  const extra = extraMenuFor(user);

  const logout = () => {
    signOut();
    window.dispatchEvent(new Event(USER_EVENT));
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
            <nav className="absolute left-0 top-0 h-full w-64 bg-white shadow-xl flex flex-col" aria-label="เมนูด้านข้าง">
              <div className="bg-[#9bdadd] px-4 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  {user && <Avatar src={user.avatarUrl} name={user.name} size={38} ring />}
                  <div className="min-w-0">
                    <p className="font-serif font-bold text-lg text-slate-900 leading-tight">SOLIFY</p>
                    <p className="text-[11px] text-slate-700 truncate max-w-[9rem]">
                      {user ? `${user.name} · ${ROLE_TEXT[user.role] || ''}` : 'ยังไม่ได้เข้าสู่ระบบ'}
                    </p>
                  </div>
                </div>
                <button onClick={() => setOpen(false)} aria-label="ปิดเมนู" className="text-slate-700">
                  <X size={22} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-2">
                <p className="px-4 pt-1 pb-1 text-[10px] font-bold text-slate-400">เมนูหลัก</p>
                {main.map((i) => (
                  <Row key={i.href} href={i.href} icon={i.icon} label={i.label === 'Support' ? 'Support Chat' : i.label} active={i.match(pathname)} badge={i.badge ? countOf(...i.badge) : 0} badgeLabel={i.badgeLabel} onNavigate={() => setOpen(false)} />
                ))}
                {extra.length > 0 && (
                  <>
                    <p className="px-4 pt-3 pb-1 text-[10px] font-bold text-slate-400 border-t mt-2">เมนูเพิ่มเติม</p>
                    {extra.map((i) => (
                      <Row key={i.href} href={i.href} icon={i.icon} label={i.label} active={false} badge={0} onNavigate={() => setOpen(false)} />
                    ))}
                  </>
                )}
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
