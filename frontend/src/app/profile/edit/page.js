'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// การแก้ไขโปรไฟล์ทำในหน้า /profile (กดไอคอนดินสอ) จึงพากลับไปที่นั่น
export default function ProfileEditRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/profile');
  }, [router]);
  return null;
}
