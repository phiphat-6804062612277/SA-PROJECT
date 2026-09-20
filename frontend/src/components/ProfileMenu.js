'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, ChevronRight, LogIn, LogOut, User as UserIcon, CheckCircle2, MessageCircle } from 'lucide-react';
import Avatar from '@/components/Avatar';
import NotificationBadge from '@/components/NotificationBadge';
import { useNotifications } from '@/components/NotificationProvider';
import { clearSession, getStoredUser, hasToken, USER_EVENT } from '@/lib/auth';

const ROLE_TEXT = { buyer: 'ผู้ซื้อ', seller: 'ผู้ขาย', admin: 'ผู้ดูแลระบบ' };

/**
 * ไอคอนโปรไฟล์ใน Header: แสดงรูปโปรไฟล์ + Badge ! เมื่อมีงานค้าง
 * กดแล้วเปิด Dropdown สรุปงานที่ต้องทำ พร้อมปุ่มไปหน้านั้นๆ ทันที
 *   showLogin = true → ถ้ายังไม่ล็อกอินจะแสดงปุ่ม "เข้าสู่ระบบ" แทน
 */
export default function ProfileMenu({ showLogin = false }) {
  const router = useRouter();
  const pathname = usePathname();
  const { total, items, loaded, error } = useNotifications();
  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  // อ่านผู้ใช้จาก localStorage (หลัง mount) และอัปเดตเมื่อมีการแก้โปรไฟล์/ออกจากระบบ
  useEffect(() => {
    const read = () => setUser(hasToken() ? getStoredUser() : null);
    read();
    window.addEventListener(USER_EVENT, read);
    window.addEventListener('storage', read);
    return () => {
      window.removeEventListener(USER_EVENT, read);
      window.removeEventListener('storage', read);
    };
  }, [pathname]);

  // ปิดเมื่อเปลี่ยนหน้า
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // ปิดเมื่อกดนอกกล่อง / กด Esc
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) {
    if (!showLogin) return null;
    return (
      <Link href="/login" className="ml-auto inline-flex items-center gap-1 bg-white/90 hover:bg-white text-slate-800 text-xs font-bold px-3 py-1.5 rounded-full">
        <LogIn size={14} /> เข้าสู่ระบบ
      </Link>
    );
  }

  const close = () => setOpen(false); // ลิงก์ที่ชี้หน้าเดิม (เช่น /seller?filter=todo ขณะอยู่ /seller) ไม่เปลี่ยน pathname จึงต้องปิดเอง

  const logout = () => {
    clearSession();
    window.dispatchEvent(new Event(USER_EVENT));
    setOpen(false);
    router.replace('/welcome');
  };

  return (
    <div ref={boxRef} className="relative ml-auto">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={total ? `เมนูโปรไฟล์ — มีงานที่ต้องดำเนินการ ${total} รายการ` : 'เมนูโปรไฟล์'}
        className="relative block rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-700"
      >
        <Avatar src={user.avatarUrl} name={user.name} size={36} ring />
        <NotificationBadge count={total} />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full mt-2 w-[19rem] max-w-[calc(100vw-1.5rem)] max-h-[75vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-100 text-slate-800 z-50">
          <Link href="/profile" role="menuitem" onClick={close} className="flex items-center gap-3 p-3 border-b hover:bg-slate-50 rounded-t-2xl">
            <Avatar src={user.avatarUrl} name={user.name} size={44} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold truncate">{user.name}</p>
              <p className="text-[11px] text-slate-500">{ROLE_TEXT[user.role] || 'ผู้ใช้'} · ดูโปรไฟล์</p>
            </div>
            <ChevronRight size={16} className="text-slate-400" />
          </Link>

          <div className="p-3 space-y-2.5">
            <p className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Bell size={14} className="text-cyan-600" /> งานที่ต้องดำเนินการ
              {total > 0 && <span className="ml-auto bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">{total}</span>}
            </p>

            {!loaded ? (
              <p className={`text-[11px] text-center py-3 ${error ? 'text-red-500' : 'text-slate-400'}`}>
                {error ? 'โหลดรายการงานค้างไม่สำเร็จ กรุณาลองใหม่อีกครั้งภายหลัง' : 'กำลังตรวจสอบ...'}
              </p>
            ) : items.length === 0 ? (
              <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 bg-slate-50 rounded-xl py-3">
                <CheckCircle2 size={14} className="text-emerald-500" /> ไม่มีงานค้าง ทุกอย่างเรียบร้อย
              </p>
            ) : (
              items.map((t) => (
                <div key={t.key} className="rounded-xl border border-red-100 bg-red-50/60 p-2.5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-black flex items-center justify-center">{t.count}</span>
                    <p className="text-xs font-bold text-slate-800 flex-1">{t.label}</p>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug text-wrap-safe">{t.description}</p>
                  {t.entries?.length > 0 && (
                    <ul className="space-y-1">
                      {t.entries.map((e) => (
                        <li key={e.id}>
                          <Link href={e.href} role="menuitem" onClick={close} className="block bg-white rounded-lg px-2 py-1.5 hover:bg-cyan-50">
                            <span className="block text-[11px] font-bold text-slate-700 truncate">{e.text}</span>
                            {e.hint && <span className="block text-[10px] text-slate-400 truncate">{e.hint}</span>}
                          </Link>
                        </li>
                      ))}
                      {t.count > t.entries.length && (
                        <li className="text-[10px] text-slate-400 px-1">และอีก {t.count - t.entries.length} รายการ</li>
                      )}
                    </ul>
                  )}
                  <Link href={t.href} role="menuitem" onClick={close} className="block text-center bg-[#9bdadd] hover:bg-cyan-300 text-slate-900 text-xs font-bold py-2 rounded-full">
                    {t.cta}
                  </Link>
                </div>
              ))
            )}
          </div>

          <div className="border-t p-1.5 grid grid-cols-2 gap-1">
            <Link href="/chat" role="menuitem" onClick={close} className={`flex items-center justify-center gap-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-xl py-2 ${user.role === 'admin' ? 'col-span-2' : ''}`}>
              <MessageCircle size={14} /> ข้อความ
            </Link>
            {user.role !== 'admin' && (
              <Link href="/chat/new?support=1" role="menuitem" onClick={close} className="flex items-center justify-center gap-1.5 text-xs font-bold text-violet-700 hover:bg-violet-50 rounded-xl py-2">
                ติดต่อ Admin
              </Link>
            )}
            <Link href="/profile" role="menuitem" onClick={close} className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-xl py-2">
              <UserIcon size={14} /> โปรไฟล์
            </Link>
            <button type="button" role="menuitem" onClick={logout} className="flex items-center justify-center gap-1.5 text-xs font-bold text-red-500 hover:bg-red-50 rounded-xl py-2">
              <LogOut size={14} /> ออกจากระบบ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
