'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import API, { errorMessage } from '@/lib/api';
import { saveSession, safeNext, homeFor, takeAuthNotice, setAppealSession, clearAppealSession } from '@/lib/auth';
import AuthShell, { authLabel, authInput, authButton, OrDivider } from '@/components/AuthShell';
import PasswordInput from '@/components/PasswordInput';
import Notice from '@/components/Notice';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  // ข้อความที่ส่งมาจากหน้าอื่น เช่น "ตั้งรหัสผ่านใหม่เรียบร้อย" / "บัญชีถูกระงับ"
  useEffect(() => {
    setNotice(takeAuthNotice());
  }, []);

  const q = params.get('next') ? `?next=${encodeURIComponent(params.get('next'))}` : '';

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setNotice('');

    try {
      const res = await API.post('/auth/login', { email, password });
      clearAppealSession();
      saveSession(res.data);
      router.replace(safeNext(params.get('next'), homeFor(res.data.user)));
    } catch (err) {
      const data = err.response?.data;
      if (err.response?.status === 403 && data?.code === 'BANNED') {
        // บัญชีถูกระงับ: ไม่ล็อกอินปกติ แต่พาไปหน้าแจ้งสถานะ + ปุ่ม "ติดต่อ Admin / ยื่นเรื่องอุทธรณ์" (ใช้โทเคนอุทธรณ์ที่ใช้ได้เฉพาะแชตซัพพอร์ต)
        setAppealSession({ token: data.appealToken || '', message: data.message, reason: data.banReason || '' });
        router.replace('/suspended');
        return;
      }
      setError(errorMessage(err, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <h1 className="font-serif font-bold text-2xl text-slate-900 text-center mt-8">LOG IN</h1>

      <form onSubmit={handleLogin} className="mt-8 space-y-4">
        <Notice type="error">{error}</Notice>
        <Notice type="info">{notice}</Notice>

        <div>
          <label htmlFor="email" className={authLabel}>Email</label>
          <input id="email" type="email" required autoComplete="email" maxLength={100} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter mail" className={authInput} />
        </div>

        <div>
          <label htmlFor="password" className={authLabel}>Password</label>
          <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>

        <button type="submit" disabled={loading} className={`${authButton} mt-2`}>
          {loading ? 'logging in...' : 'log in'}
        </button>

        <div className="text-right">
          <Link href="/forgot-password" className="text-[11px] text-slate-800 hover:underline">Forget Password?</Link>
        </div>
      </form>

      <OrDivider />

      <div className="flex justify-between text-[11px] text-slate-800">
        <span>Didn&apos;t have account?</span>
        <Link href={`/register${q}`} className="text-blue-600 hover:underline">sign up</Link>
      </div>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
