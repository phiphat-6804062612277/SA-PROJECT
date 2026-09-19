'use client';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import ProfileMenu from '@/components/ProfileMenu';

// profile = false เพื่อซ่อนไอคอนโปรไฟล์/แจ้งเตือนในหน้านั้น
export default function PageHeader({ title, back = false, right = null, profile = true }) {
  const router = useRouter();
  return (
    <div className="bg-[#9bdadd] px-4 py-3 flex items-center gap-3 sticky top-0 z-30">
      {back && (
        <button onClick={() => router.back()} aria-label="ย้อนกลับ" className="text-slate-700">
          <ArrowLeft size={22} />
        </button>
      )}
      <h1 className="font-bold text-slate-800 text-base flex-1 truncate">{title}</h1>
      {right}
      {profile && (
        <div className="shrink-0 flex">
          <ProfileMenu />
        </div>
      )}
    </div>
  );
}
