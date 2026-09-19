'use client';
import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import AuthShell from '@/components/AuthShell';
import SolifyLogo from '@/components/SolifyLogo';
import { safeNext } from '@/lib/auth';

// หน้าเริ่มต้น (Wireframe "login signin"): โลโก้ + ปุ่ม log in / sign up
function Welcome() {
  const params = useSearchParams();
  const next = safeNext(params.get('next'), '');
  const q = next ? `?next=${encodeURIComponent(next)}` : '';

  return (
    <AuthShell>
      <div className="flex flex-col items-center min-h-[calc(100vh-9rem)]">
        <div className="flex-1 flex flex-col items-center justify-center pt-4">
          <SolifyLogo size={150} />
          <h1 className="font-serif font-bold text-xl text-slate-900 mt-4 tracking-wide">SOLIFY</h1>
          <div className="w-28 h-px bg-slate-900 mt-1" />
          <p className="font-serif font-semibold text-sm text-slate-900 mt-2">sign here</p>
        </div>

        <div className="w-full space-y-2">
          <Link href={`/login${q}`} className="block w-full text-center bg-white border border-slate-900 rounded-full py-2 text-sm text-slate-900 hover:bg-slate-50">
            log in
          </Link>
          <Link href={`/register${q}`} className="block w-full text-center bg-[#d9d9d9] border border-slate-900 rounded-full py-2 text-sm text-slate-900 hover:bg-[#cfcfcf]">
            sign up
          </Link>
          <Link href="/" className="block text-center text-[11px] text-slate-600 underline pt-2">
            เข้าชมสินค้าโดยไม่ต้องเข้าสู่ระบบ
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}

export default function WelcomePage() {
  return (
    <Suspense fallback={null}>
      <Welcome />
    </Suspense>
  );
}
