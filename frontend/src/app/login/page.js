'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import API, { errorMessage } from '@/lib/api';
import { saveSession, safeNext, homeFor } from '@/lib/auth';
import Notice from '@/components/Notice';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await API.post('/auth/login', { email, password });
      saveSession(res.data);
      router.replace(safeNext(params.get('next'), homeFor(res.data.user)));
    } catch (err) {
      setError(errorMessage(err, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#e0f7f7] min-h-screen flex items-center justify-center p-4">
      <div className="bg-white p-6 rounded-3xl shadow-sm w-full max-w-md space-y-4">
        <div className="text-center">
          <div className="text-4xl">☀️</div>
          <h1 className="text-xl font-bold text-slate-800 mt-1">เข้าสู่ระบบ Solify</h1>
        </div>

        <Notice type="error">{error}</Notice>

        <form onSubmit={handleLogin} className="space-y-3 text-xs">
          <div>
            <label htmlFor="email" className="font-bold text-slate-700">อีเมล</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-cyan-500"
              placeholder="example@gmail.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="font-bold text-slate-700">รหัสผ่าน</label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full mt-1 p-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-cyan-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#8be0e0] hover:bg-cyan-300 text-slate-900 font-bold py-3 rounded-full text-sm mt-2 disabled:opacity-50"
          >
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-500">
          ยังไม่มีบัญชี? <Link href="/register" className="text-cyan-600 font-bold">สมัครสมาชิก</Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
