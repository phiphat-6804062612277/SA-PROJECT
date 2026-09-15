'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import API from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await API.post('/auth/login', formData);
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));

      alert('เข้าสู่ระบบสำเร็จ!');
      router.push('/shopping');
    } catch (err) {
      setError(err.response?.data?.message || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#e0f7f7] min-h-screen flex flex-col justify-center px-6 py-12">
      <div className="sm:mx-auto sm:w-full sm:max-w-md bg-white p-8 rounded-3xl shadow-md">
        <h2 className="text-center text-2xl font-black text-slate-900 mb-6">LOG IN</h2>
        
        {error && <div className="bg-red-100 text-red-600 text-xs p-3 rounded-xl mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700">Email</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full mt-1 bg-slate-100 text-slate-900 placeholder-slate-400 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-cyan-400 outline-none"
              placeholder="Hello"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700">Password</label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full mt-1 bg-slate-100 text-slate-900 placeholder-slate-400 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-cyan-400 outline-none"
              placeholder="••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#a3e4e4] hover:bg-[#81d8d8] text-slate-900 font-bold py-3 rounded-full text-sm transition mt-4 shadow-sm"
          >
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'Log In'}
          </button>
        </form>
      </div>
    </div>
  );
}