'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import API, { errorMessage } from '@/lib/api';
import AuthShell, { authButton } from '@/components/AuthShell';
import Notice from '@/components/Notice';

const LENGTH = 5;
const COOLDOWN = 30; // วินาที ต้องตรงกับฝั่ง backend

// ขั้นที่ 2 (Wireframe "forget password otp"): กรอกรหัส OTP 5 หลัก
export default function OtpPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [digits, setDigits] = useState(Array(LENGTH).fill(''));
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [demoOtp, setDemoOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [wait, setWait] = useState(0);
  const refs = useRef([]);

  useEffect(() => {
    const saved = sessionStorage.getItem('resetEmail');
    if (!saved) {
      router.replace('/forgot-password');
      return;
    }
    setEmail(saved);
    setDemoOtp(sessionStorage.getItem('demoOtp') || '');
    const sentAt = Number(sessionStorage.getItem('resetSentAt') || 0);
    setWait(Math.max(0, COOLDOWN - Math.floor((Date.now() - sentAt) / 1000)));
    refs.current[0]?.focus();
  }, [router]);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const setDigit = (i, value) => {
    const d = value.replace(/\D/g, '');
    if (!d) {
      const next = [...digits];
      next[i] = '';
      setDigits(next);
      return;
    }
    // วางรหัสหลายหลักพร้อมกัน (paste) หรือพิมพ์ทีละตัว
    const next = [...digits];
    d.slice(0, LENGTH - i).split('').forEach((ch, k) => {
      next[i + k] = ch;
    });
    setDigits(next);
    refs.current[Math.min(i + d.length, LENGTH - 1)]?.focus();
  };

  const onKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
    if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < LENGTH - 1) refs.current[i + 1]?.focus();
  };

  const code = digits.join('');

  const handleVerify = async (e) => {
    e.preventDefault();
    if (code.length < LENGTH) return setError(`กรุณากรอกรหัส OTP ให้ครบ ${LENGTH} หลัก`);
    setError('');
    setLoading(true);
    try {
      const res = await API.post('/auth/verify-otp', { email, otp: code });
      sessionStorage.setItem('resetToken', res.data.resetToken);
      sessionStorage.removeItem('demoOtp');
      router.push('/forgot-password/reset');
    } catch (err) {
      setError(errorMessage(err));
      setDigits(Array(LENGTH).fill(''));
      refs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setInfo('');
    try {
      const res = await API.post('/auth/forgot-password', { email });
      sessionStorage.setItem('resetSentAt', String(Date.now()));
      setWait(COOLDOWN);
      setInfo('ส่งรหัส OTP ใหม่แล้ว');
      if (res.data.demoOtp) {
        sessionStorage.setItem('demoOtp', res.data.demoOtp);
        setDemoOtp(res.data.demoOtp);
      }
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <AuthShell title="Enter OTP!" subtitle="Enter code shared on your email." back>
      <form onSubmit={handleVerify} className="space-y-4">
        <Notice type="error">{error}</Notice>
        <Notice type="success">{info}</Notice>

        <div className="flex justify-between gap-2" role="group" aria-label="รหัส OTP 5 หลัก">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => (refs.current[i] = el)}
              value={d}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              onFocus={(e) => e.target.select()}
              inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              maxLength={LENGTH}
              aria-label={`หลักที่ ${i + 1}`}
              className="w-11 h-11 text-center text-lg font-bold rounded-lg border border-slate-400 bg-white text-slate-900 outline-none focus:ring-2 focus:ring-cyan-400"
            />
          ))}
        </div>

        <button type="submit" disabled={loading} className={authButton}>
          {loading ? 'verifying...' : 'Verify'}
        </button>

        <div className="text-right">
          {wait > 0 ? (
            <span className="text-[11px] text-slate-500">Resend ได้ใน {wait} วินาที</span>
          ) : (
            <button type="button" onClick={handleResend} className="text-[11px] text-blue-600 hover:underline">
              Resend
            </button>
          )}
        </div>

        {demoOtp && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-[11px] text-amber-800">
            <b>โหมดสาธิต:</b> ระบบยังไม่ได้ต่อบริการส่งอีเมล รหัส OTP ของคุณคือ{' '}
            <b className="font-mono text-base tracking-widest">{demoOtp}</b>
          </div>
        )}
      </form>
    </AuthShell>
  );
}
