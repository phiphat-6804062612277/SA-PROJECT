'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getStoredUser, hasToken } from '@/lib/auth';

/**
 * ป้องกันหน้าที่ต้องล็อกอิน
 *   const { user } = useAuth();                    // ทุกบทบาท
 *   const { user } = useAuth({ roles: ['seller'] }) // เฉพาะผู้ขาย
 * user จะเป็น null จนกว่าจะตรวจสิทธิ์เสร็จ (ให้แสดง loading ไปก่อน)
 * ถ้ายังไม่ล็อกอิน → ไปหน้า /login แล้วพากลับมาหน้าเดิมหลังล็อกอิน
 */
export function useAuth({ roles } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const roleKey = roles ? roles.join(',') : '';

  useEffect(() => {
    const u = getStoredUser();
    if (!hasToken() || !u) {
      const next = window.location.pathname + window.location.search;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    if (roleKey && !roleKey.split(',').includes(u.role)) {
      router.replace('/profile');
      return;
    }
    setUser(u);
  }, [pathname, roleKey, router]);

  return { user };
}
