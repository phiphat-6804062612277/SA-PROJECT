'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LogIn } from 'lucide-react';
import Avatar from '@/components/Avatar';
import { getStoredUser, hasToken, USER_EVENT } from '@/lib/auth';

/**
 * รูปโปรไฟล์ในหัวหน้า — กดเพื่อไปหน้าโปรไฟล์ (ไม่มี Badge แล้ว: การแจ้งเตือนย้ายไปที่เมนูที่เกี่ยวข้องในแถบเมนูล่างแทน
 * เช่น คำสั่งซื้อ / ออเดอร์ร้าน / ข้อพิพาท / ข้อความ)
 *   showLogin = true → ถ้ายังไม่ล็อกอินจะแสดงปุ่ม "เข้าสู่ระบบ" แทน
 */
export default function ProfileMenu({ showLogin = false }) {
  const [user, setUser] = useState(null);

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
  }, []);

  if (!user) {
    if (!showLogin) return null;
    return (
      <Link href="/login" className="inline-flex items-center gap-1 bg-white/90 hover:bg-white text-slate-800 text-xs font-bold px-3 py-1.5 rounded-full">
        <LogIn size={14} /> เข้าสู่ระบบ
      </Link>
    );
  }

  return (
    <Link href="/profile" aria-label={`โปรไฟล์ของ ${user.name}`} className="block rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-700">
      <Avatar src={user.avatarUrl} name={user.name} size={36} ring />
    </Link>
  );
}
