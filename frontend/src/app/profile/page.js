'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, Phone, MapPin, Edit3, Save, LogOut, ClipboardList, Wallet, Store, ChevronRight } from 'lucide-react';
import API, { errorMessage } from '@/lib/api';
import { clearSession, updateStoredUser } from '@/lib/auth';
import { useAuth } from '@/lib/useAuth';
import PageHeader from '@/components/PageHeader';
import Loading from '@/components/Loading';
import Notice from '@/components/Notice';

const inputCls =
  'w-full mt-1 p-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-cyan-500';

export default function ProfilePage() {
  const router = useRouter();
  const { user: sessionUser } = useAuth();
  const [user, setUser] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', address: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: 'info', text: '' });

  useEffect(() => {
    if (!sessionUser) return;
    API.get('/auth/me')
      .then((res) => {
        setUser(res.data);
        setFormData({ name: res.data.name || '', phone: res.data.phone || '', address: res.data.address || '' });
        updateStoredUser(res.data);
      })
      .catch((err) => setMessage({ type: 'error', text: errorMessage(err) }));
  }, [sessionUser]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: 'info', text: '' });
    try {
      const res = await API.put('/auth/profile', formData);
      setUser(res.data.user);
      updateStoredUser(res.data.user);
      setIsEditing(false);
      setMessage({ type: 'success', text: 'อัปเดตข้อมูลสำเร็จ' });
    } catch (err) {
      setMessage({ type: 'error', text: errorMessage(err, 'เกิดข้อผิดพลาดในการอัปเดต') });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    clearSession();
    router.replace('/login');
  };

  if (!sessionUser) return <Loading text="กำลังโหลดข้อมูล..." />;
  const me = user || sessionUser;
  const isSeller = me.role === 'seller';

  const menu = [
    ...(isSeller ? [{ href: '/seller', icon: Store, label: 'ร้านค้าของฉัน (สินค้า / ออเดอร์)' }] : []),
    ...(!isSeller ? [{ href: '/history', icon: ClipboardList, label: 'คำสั่งซื้อของฉัน' }] : []),
    { href: '/wallet', icon: Wallet, label: 'Wallet และประวัติรายการ' },
  ];

  return (
    <div className="bg-[#e0f7f7] min-h-screen pb-4">
      <PageHeader title="จัดการโปรไฟล์" />

      <div className="p-4 space-y-4">
        <Notice type={message.type}>{message.text}</Notice>

        <div className="bg-white p-5 rounded-3xl shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-12 h-12 bg-cyan-100 rounded-full flex items-center justify-center text-cyan-700 shrink-0">
                <User className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-slate-900 text-sm truncate">{me.name}</h2>
                <p className="text-xs text-slate-500 truncate">{me.email}</p>
                <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700">
                  {isSeller ? 'ผู้ขาย' : 'ผู้ซื้อ'}
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsEditing(!isEditing)}
              aria-label="แก้ไขโปรไฟล์"
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          </div>

          {isEditing ? (
            <form onSubmit={handleUpdate} className="space-y-3 text-xs">
              <div>
                <label htmlFor="p-name" className="font-bold text-slate-700">ชื่อ-นามสกุล</label>
                <input id="p-name" type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label htmlFor="p-phone" className="font-bold text-slate-700">เบอร์โทรศัพท์</label>
                <input id="p-phone" type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label htmlFor="p-address" className="font-bold text-slate-700">{isSeller ? 'ที่อยู่ร้านค้า' : 'ที่อยู่จัดส่ง'}</label>
                <textarea id="p-address" rows={3} value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className={inputCls} />
              </div>

              <div className="flex space-x-2 pt-2">
                <button type="submit" disabled={saving} className="flex-1 bg-[#8be0e0] hover:bg-cyan-300 text-slate-900 font-bold py-2.5 rounded-full flex items-center justify-center space-x-1 disabled:opacity-50">
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</span>
                </button>
                <button type="button" onClick={() => setIsEditing(false)} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2.5 rounded-full">
                  ยกเลิก
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3 text-xs text-slate-700">
              <div className="flex items-start space-x-2">
                <Phone className="w-4 h-4 text-cyan-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold text-slate-500 text-[10px]">เบอร์โทรศัพท์</p>
                  <p className="font-semibold">{me.phone || 'ยังไม่ได้ระบุ'}</p>
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <MapPin className="w-4 h-4 text-cyan-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold text-slate-500 text-[10px]">{isSeller ? 'ที่อยู่ร้านค้า' : 'ที่อยู่จัดส่งสินค้า'}</p>
                  <p className="font-semibold leading-relaxed">{me.address || 'ยังไม่ได้ระบุ'}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm divide-y">
          {menu.map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href} className="flex items-center gap-3 p-4 text-xs font-bold text-slate-700 hover:bg-slate-50">
              <Icon size={18} className="text-cyan-600" />
              <span className="flex-1">{label}</span>
              <ChevronRight size={16} className="text-slate-400" />
            </Link>
          ))}
        </div>

        <button
          onClick={handleLogout}
          className="w-full bg-white hover:bg-red-50 text-red-500 font-bold py-3 rounded-2xl text-xs flex items-center justify-center space-x-2 border border-red-100 shadow-sm"
        >
          <LogOut className="w-4 h-4" />
          <span>ออกจากระบบ</span>
        </button>
      </div>
    </div>
  );
}
