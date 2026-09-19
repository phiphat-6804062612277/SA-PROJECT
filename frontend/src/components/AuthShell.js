'use client';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

// โครงหน้า Login/สมัครสมาชิก/ลืมรหัสผ่าน ตาม Wireframe: แถบสีฟ้าด้านบน + พื้นหลังสว่าง + หัวข้อตัวอักษรมีเชิง
export default function AuthShell({ title, subtitle, back = false, children }) {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-[#f0ffff] flex flex-col">
      <div className="h-9 bg-[#9bdadd]" />
      {back && (
        <button onClick={() => router.back()} aria-label="ย้อนกลับ" className="self-start px-6 pt-4 text-slate-800">
          <ArrowLeft size={22} />
        </button>
      )}
      <div className="flex-1 px-8 pt-10 pb-10">
        {title && <h1 className="font-serif font-bold text-2xl text-slate-900">{title}</h1>}
        {subtitle && <p className="text-xs text-slate-700 mt-2">{subtitle}</p>}
        <div className={title ? 'mt-6' : ''}>{children}</div>
      </div>
    </div>
  );
}

// สไตล์ร่วมของฟอร์มในหน้า Auth (ช่องกรอกสีเทา ปุ่มทรงแคปซูล ตาม Wireframe)
export const authLabel = 'block text-sm text-slate-900 mb-1';
export const authInput =
  'w-full bg-[#d9d9d9] text-slate-900 text-sm px-3 py-2.5 rounded-sm placeholder:text-slate-500 placeholder:text-xs outline-none focus:ring-2 focus:ring-cyan-400';
export const authButton =
  'w-full bg-[#d9d9d9] text-slate-900 text-sm py-2.5 rounded-full border border-slate-900 hover:bg-[#cfcfcf] disabled:opacity-50 transition';

export function OrDivider() {
  return (
    <div className="flex items-center gap-2 my-4 text-[10px] text-slate-700" aria-hidden="true">
      <div className="flex-1 h-px bg-slate-400" />
      or
      <div className="flex-1 h-px bg-slate-400" />
    </div>
  );
}
