'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, MapPin, Edit3, Save, LogOut } from 'lucide-react';
import API, { errorMessage } from '@/lib/api';
import { clearSession, updateStoredUser } from '@/lib/auth';
import { validatePhone } from '@/lib/phone';
import { LIMITS } from '@/lib/limits';
import { useAuth } from '@/lib/useAuth';
import PageHeader from '@/components/PageHeader';
import Loading from '@/components/Loading';
import Notice from '@/components/Notice';
import ReviewList from '@/components/ReviewList';
import ImageUploader from '@/components/ImageUploader';
import TrustBadge from '@/components/TrustBadge';
import { useToast } from '@/components/Toast';

const inputCls =
  'w-full mt-1 p-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-cyan-500';

export default function ProfilePage() {
  const router = useRouter();
  const { user: sessionUser } = useAuth();
  const toast = useToast();
  const [received, setReceived] = useState({ rating: { avg: 0, count: 0 }, reviews: [] });
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
    if (sessionUser.role !== 'admin') {
      API.get('/reviews/received')
        .then((res) => setReceived(res.data))
        .catch(() => {});
    }
  }, [sessionUser]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setMessage({ type: 'info', text: '' });
    const phone = validatePhone(formData.phone);
    if (!phone.ok) {
      setMessage({ type: 'error', text: phone.message });
      return;
    }
    setSaving(true);
    try {
      const res = await API.put('/auth/profile', { ...formData, phone: phone.value });
      setUser(res.data.user);
      updateStoredUser(res.data.user);
      setIsEditing(false);
      toast.success('อัปเดตข้อมูลโปรไฟล์แล้ว');
    } catch (err) {
      setMessage({ type: 'error', text: errorMessage(err, 'เกิดข้อผิดพลาดในการอัปเดต') });
    } finally {
      setSaving(false);
    }
  };

  // เปลี่ยน/ลบรูปโปรไฟล์: อัปโหลดเสร็จแล้วบันทึกเข้าโปรไฟล์ทันที (ไม่ต้องเข้าโหมดแก้ไข)
  const saveAvatar = async (avatarUrl) => {
    setMessage({ type: 'info', text: '' });
    try {
      const res = await API.put('/auth/profile', { avatarUrl });
      setUser(res.data.user);
      updateStoredUser(res.data.user);
      toast.success(avatarUrl ? 'อัปเดตรูปโปรไฟล์แล้ว' : 'ลบรูปโปรไฟล์แล้ว');
    } catch (err) {
      setMessage({ type: 'error', text: errorMessage(err, 'บันทึกรูปโปรไฟล์ไม่สำเร็จ') });
    }
  };

  const handleLogout = () => {
    clearSession();
    router.replace('/welcome');
  };

  if (!sessionUser) return <Loading text="กำลังโหลดข้อมูล..." />;
  const me = user || sessionUser;
  const isSeller = me.role === 'seller';
  const isAdmin = me.role === 'admin';

  return (
    <div className="bg-[#e0f7f7] min-h-screen pb-4">
      <PageHeader title="จัดการโปรไฟล์" profile={false} />

      <div className="p-4 space-y-4">
        <Notice type={message.type}>{message.text}</Notice>

        <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
          <div className="h-24 bg-gradient-to-br from-[#9bdadd] via-cyan-200 to-sky-300" aria-hidden="true" />
          <div className="px-5 pb-5 space-y-4">
          <div className="-mt-12 flex justify-center relative z-10">
            <ImageUploader kind="avatar" shape="avatar" value={me.avatarUrl} name={me.name} onChange={saveAvatar} hint="JPEG / PNG / WebP — ระบบย่อรูปให้อัตโนมัติ" />
          </div>
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="min-w-0">
                <h2 className="font-bold text-slate-900 text-sm truncate">{me.name}</h2>
                <p className="text-xs text-slate-500 truncate">{me.email}</p>
                <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700">
                  {isAdmin ? 'ผู้ดูแลระบบ' : isSeller ? 'ผู้ขาย' : 'ผู้ซื้อ'}
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
                <input id="p-name" type="text" required maxLength={LIMITS.USER_NAME} value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label htmlFor="p-phone" className="font-bold text-slate-700">เบอร์โทรศัพท์</label>
                <input id="p-phone" type="tel" inputMode="tel" placeholder="0812345678" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label htmlFor="p-address" className="font-bold text-slate-700">{isSeller ? 'ที่อยู่ร้านค้า' : 'ที่อยู่จัดส่ง'}</label>
                <textarea id="p-address" rows={3} maxLength={500} value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className={inputCls} />
              </div>

              <div className="flex space-x-2 pt-2">
                <button type="submit" disabled={saving} className="flex-1 bg-[#9bdadd] hover:bg-cyan-300 text-slate-900 font-bold py-2.5 rounded-full flex items-center justify-center space-x-1 disabled:opacity-50">
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
                  <p className="font-semibold leading-relaxed text-wrap-safe">{me.address || 'ยังไม่ได้ระบุ'}</p>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>

        {!isAdmin && (
          <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
            {!isSeller && received.trust && (
              <div className="bg-slate-50 rounded-xl p-3 space-y-1">
                <p className="text-[10px] font-bold text-slate-500">ความน่าเชื่อถือของคุณ (ที่ผู้ขายและผู้ซื้ออื่นเห็นข้างชื่อในรีวิว)</p>
                <TrustBadge trust={received.trust} />
              </div>
            )}
            <ReviewList
              title={isSeller ? 'รีวิวจากผู้ซื้อ' : 'รีวิวจากผู้ขาย'}
              rating={received.rating}
              reviews={received.reviews}
              emptyText="ยังไม่มีรีวิว"
            />
          </div>
        )}

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
