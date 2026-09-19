'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import API, { errorMessage } from '@/lib/api';
import { saveSession, homeFor, safeNext } from '@/lib/auth';
import { LIMITS } from '@/lib/limits';
import AuthShell, { authLabel, authInput, authButton, OrDivider } from '@/components/AuthShell';
import PasswordInput from '@/components/PasswordInput';
import Notice from '@/components/Notice';

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [form, setForm] = useState({ email: '', name: '', password: '', role: '', adminCode: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const q = params.get('next') ? `?next=${encodeURIComponent(params.get('next'))}` : '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.role) return setError('กรุณาเลือกบทบาท (Seller / Buyer / Admin)');
    if (form.password.length < 6) return setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');

    setLoading(true);
    try {
      // ค่าที่ไม่เกี่ยวข้อง (adminCode ของผู้ซื้อ/ผู้ขาย) ไม่ต้องส่ง
      const payload = { email: form.email, name: form.name, password: form.password, role: form.role };
      if (form.role === 'admin') payload.adminCode = form.adminCode;
      const res = await API.post('/auth/register', payload);
      saveSession(res.data); // สมัครเสร็จล็อกอินให้เลย
      router.replace(safeNext(params.get('next'), homeFor(res.data.user)));
    } catch (err) {
      setError(errorMessage(err, 'เกิดข้อผิดพลาดในการสมัครสมาชิก'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <h1 className="font-serif font-bold text-2xl text-slate-900 text-center mt-2">sign up</h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        <Notice type="error">{error}</Notice>

        <div>
          <label htmlFor="email" className={authLabel}>Email</label>
          <input id="email" type="email" required autoComplete="email" maxLength={100} value={form.email} onChange={set('email')} placeholder="Enter mail" className={authInput} />
        </div>

        <div>
          <label htmlFor="name" className={authLabel}>User Name</label>
          <input id="name" type="text" required autoComplete="username" maxLength={LIMITS.USER_NAME} value={form.name} onChange={set('name')} placeholder="Enter User name" className={authInput} />
        </div>

        <div>
          <label htmlFor="password" className={authLabel}>Password</label>
          <PasswordInput id="password" value={form.password} onChange={set('password')} autoComplete="new-password" minLength={6} />
          <p className="text-[10px] text-slate-500 mt-1">อย่างน้อย 6 ตัวอักษร</p>
        </div>

        <div>
          <label htmlFor="role" className={authLabel}>Role</label>
          <div className="relative">
            <select
              id="role"
              required
              value={form.role}
              onChange={set('role')}
              className={`${authInput} appearance-none pr-9 ${form.role ? '' : 'text-slate-500 text-xs'}`}
            >
              <option value="" disabled>Seller / Buyer/Admin</option>
              <option value="buyer">Buyer (ผู้ซื้อ)</option>
              <option value="seller">Seller (ผู้ขาย)</option>
              <option value="admin">Admin (ผู้ดูแลระบบ)</option>
            </select>
            <ChevronDown size={18} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-900 pointer-events-none" />
          </div>
        </div>

        {form.role === 'admin' && (
          <div>
            <label htmlFor="adminCode" className={authLabel}>Admin Code</label>
            <PasswordInput id="adminCode" value={form.adminCode} onChange={set('adminCode')} placeholder="รหัสลับสำหรับผู้ดูแลระบบ" />
            <p className="text-[10px] text-slate-500 mt-1">ต้องใช้รหัสที่เจ้าของระบบตั้งไว้ (ADMIN_SIGNUP_CODE)</p>
          </div>
        )}

        <button type="submit" disabled={loading} className={`${authButton} mt-1`}>
          {loading ? 'signing up...' : 'sign up'}
        </button>
      </form>

      <OrDivider />

      <div className="flex justify-between text-[11px] text-slate-800">
        <span>Already have an account?</span>
        <Link href={`/login${q}`} className="text-blue-600 hover:underline">log in</Link>
      </div>
    </AuthShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
