'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import API, { errorMessage } from '@/lib/api';
import AuthShell, { authLabel, authButton } from '@/components/AuthShell';
import PasswordInput from '@/components/PasswordInput';
import Notice from '@/components/Notice';

// ขั้นที่ 3 (Wireframe "forget password create"): ตั้งรหัสผ่านใหม่
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sessionStorage.getItem('resetToken')) router.replace('/forgot-password');
  }, [router]);

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) return setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
    if (password !== confirm) return setError('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน');

    setLoading(true);
    try {
      const res = await API.post('/auth/reset-password', {
        resetToken: sessionStorage.getItem('resetToken'),
        password,
      });
      ['resetToken', 'resetEmail', 'resetSentAt', 'demoOtp'].forEach((k) => sessionStorage.removeItem(k));
      sessionStorage.setItem('authNotice', res.data.message);
      router.replace('/login');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Create New Password" back>
      <form onSubmit={handleReset} className="space-y-4">
        <Notice type="error">{error}</Notice>
        <div>
          <label htmlFor="password" className={authLabel}>Password</label>
          <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={6} />
        </div>
        <div>
          <label htmlFor="confirm" className={authLabel}>Confirm Password</label>
          <PasswordInput id="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Enter Confirm password" autoComplete="new-password" minLength={6} />
        </div>
        <button type="submit" disabled={loading} className={authButton}>
          {loading ? 'saving...' : 'Reset Password'}
        </button>
      </form>
    </AuthShell>
  );
}
