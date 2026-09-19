'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import API, { errorMessage } from '@/lib/api';
import AuthShell, { authLabel, authInput, authButton } from '@/components/AuthShell';
import Notice from '@/components/Notice';

// ขั้นที่ 1 (Wireframe "forget password"): กรอกอีเมลเพื่อรับรหัส OTP
export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleNext = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await API.post('/auth/forgot-password', { email });
      sessionStorage.setItem('resetEmail', email.trim().toLowerCase());
      sessionStorage.setItem('resetSentAt', String(Date.now()));
      if (res.data.demoOtp) sessionStorage.setItem('demoOtp', res.data.demoOtp);
      else sessionStorage.removeItem('demoOtp');
      router.push('/forgot-password/otp');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Set a new password" back>
      <form onSubmit={handleNext} className="space-y-4">
        <Notice type="error">{error}</Notice>
        <div>
          <label htmlFor="email" className={authLabel}>Email</label>
          <input id="email" type="email" required autoComplete="email" maxLength={100} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter mail" className={authInput} />
        </div>
        <button type="submit" disabled={loading} className={authButton}>
          {loading ? 'sending...' : 'Next'}
        </button>
      </form>
    </AuthShell>
  );
}
