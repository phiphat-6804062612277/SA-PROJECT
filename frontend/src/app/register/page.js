'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShoppingBag, Store } from 'lucide-react';
import API, { errorMessage } from '@/lib/api';
import { saveSession, homeFor } from '@/lib/auth';
import Notice from '@/components/Notice';

const inputCls =
  'w-full mt-1 p-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-cyan-500';

const ROLES = [
  { value: 'buyer', label: 'ผู้ซื้อ', desc: 'เลือกซื้อสินค้า', icon: ShoppingBag },
  { value: 'seller', label: 'ผู้ขาย', desc: 'เปิดร้านลงสินค้า', icon: Store },
];

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    address: '',
    role: 'buyer',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (formData.password.length < 6) {
      setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }
    setLoading(true);

    try {
      const res = await API.post('/auth/register', formData);
      saveSession(res.data); // สมัครเสร็จล็อกอินให้เลย
      router.replace(homeFor(res.data.user));
    } catch (err) {
      setError(errorMessage(err, 'เกิดข้อผิดพลาดในการสมัครสมาชิก'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#e0f7f7] min-h-screen flex items-center justify-center p-4">
      <div className="bg-white p-6 rounded-3xl shadow-sm w-full max-w-md space-y-4">
        <h1 className="text-xl font-bold text-center text-slate-800">สมัครสมาชิก</h1>

        <Notice type="error">{error}</Notice>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <span className="font-bold text-slate-700">คุณต้องการสมัครเป็น</span>
            <div className="grid grid-cols-2 gap-2 mt-1" role="radiogroup" aria-label="บทบาท">
              {ROLES.map(({ value, label, desc, icon: Icon }) => {
                const active = formData.role === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setFormData({ ...formData, role: value })}
                    className={`p-3 rounded-2xl border-2 text-center transition ${
                      active ? 'border-cyan-500 bg-cyan-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <Icon className={`mx-auto ${active ? 'text-cyan-600' : 'text-slate-400'}`} size={22} />
                    <p className="font-bold text-slate-800 mt-1 text-sm">{label}</p>
                    <p className="text-[10px] text-slate-500">{desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="name" className="font-bold text-slate-700">ชื่อ-นามสกุล</label>
            <input id="name" type="text" name="name" required value={formData.name} onChange={handleChange} className={inputCls} placeholder="สมชาย สายลม" />
          </div>

          <div>
            <label htmlFor="email" className="font-bold text-slate-700">อีเมล</label>
            <input id="email" type="email" name="email" required autoComplete="email" value={formData.email} onChange={handleChange} className={inputCls} placeholder="example@gmail.com" />
          </div>

          <div>
            <label htmlFor="password" className="font-bold text-slate-700">รหัสผ่าน (อย่างน้อย 6 ตัว)</label>
            <input id="password" type="password" name="password" required minLength={6} autoComplete="new-password" value={formData.password} onChange={handleChange} className={inputCls} placeholder="••••••••" />
          </div>

          <div>
            <label htmlFor="phone" className="font-bold text-slate-700">เบอร์โทรศัพท์</label>
            <input id="phone" type="tel" name="phone" value={formData.phone} onChange={handleChange} className={inputCls} placeholder="0812345678" />
          </div>

          <div>
            <label htmlFor="address" className="font-bold text-slate-700">
              {formData.role === 'seller' ? 'ที่อยู่ร้านค้า' : 'ที่อยู่จัดส่ง'}
            </label>
            <textarea
              id="address"
              name="address"
              rows={2}
              value={formData.address}
              onChange={handleChange}
              className={inputCls}
              placeholder="123/45 ถนนวิภาวดีรังสิต แขวงลาดยาว เขตจตุจักร กทม. 10900"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#8be0e0] hover:bg-cyan-300 text-slate-900 font-bold py-3 rounded-full text-sm mt-2 disabled:opacity-50"
          >
            {loading ? 'กำลังบันทึก...' : 'สมัครสมาชิก'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-500">
          มีบัญชีอยู่แล้ว? <Link href="/login" className="text-cyan-600 font-bold">เข้าสู่ระบบ</Link>
        </p>
      </div>
    </div>
  );
}
