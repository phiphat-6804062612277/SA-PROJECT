'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import API, { errorMessage } from '@/lib/api';
import { LIMITS } from '@/lib/limits';
import { updateStoredUser } from '@/lib/auth';
import { useAuth } from '@/lib/useAuth';
import PageHeader from '@/components/PageHeader';
import Loading from '@/components/Loading';
import Notice from '@/components/Notice';
import ImageUploader from '@/components/ImageUploader';
import StoreHero from '@/components/StoreHero';
import { useToast } from '@/components/Toast';

const inputCls =
  'w-full mt-1 p-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-cyan-500';

// ตั้งค่าร้านค้า: ชื่อร้าน + คำอธิบายร้าน + โลโก้ + แบนเนอร์ปก (พร้อมตัวอย่างหน้าร้านแบบสด)
export default function StoreSettingsPage() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth({ roles: ['seller'] });
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    API.get('/auth/me')
      .then((res) =>
        setForm({
          storeName: res.data.storeName || res.data.name,
          storeDescription: res.data.storeDescription || '',
          storeLogoUrl: res.data.storeLogoUrl || '',
          storeBannerUrl: res.data.storeBannerUrl || '',
        })
      )
      .catch((err) => setError(errorMessage(err)));
  }, [user]);

  if (!user || !form) return <Loading />;

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await API.put('/stores/me', form);
      updateStoredUser(res.data.user);
      toast.success('บันทึกข้อมูลร้านค้าแล้ว');
      router.replace('/seller');
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <div className="bg-[#dcf0f1] min-h-screen">
      <PageHeader title="ตั้งค่าร้านค้า" back />
      <div className="p-4 space-y-3">
        <div>
          <p className="text-[11px] font-bold text-slate-500 mb-1.5">ตัวอย่างหน้าร้านที่ผู้ซื้อจะเห็น</p>
          <StoreHero name={form.storeName.trim() || 'ชื่อร้านของคุณ'} logoUrl={form.storeLogoUrl} bannerUrl={form.storeBannerUrl} subtitle={`โดย ${user.name}`} />
        </div>

        <form onSubmit={submit} className="bg-white p-5 rounded-3xl shadow-sm space-y-4 text-xs">
          <ImageUploader kind="banner" shape="banner" label="รูปปกร้าน (แบนเนอร์)" value={form.storeBannerUrl} onChange={(url) => setForm({ ...form, storeBannerUrl: url })} hint="แนะนำภาพแนวนอนอัตราส่วน 3:1 — ระบบย่อรูปให้อัตโนมัติ" disabled={saving} />
          <ImageUploader kind="logo" shape="logo" label="โลโก้ร้าน" name={form.storeName} value={form.storeLogoUrl} onChange={(url) => setForm({ ...form, storeLogoUrl: url })} hint="ภาพสี่เหลี่ยมจัตุรัสจะแสดงสวยที่สุด" disabled={saving} />
          <div>
            <div className="flex justify-between items-end">
              <label htmlFor="sn" className="font-bold text-slate-700">ชื่อร้านค้า</label>
              <span className="text-[10px] text-slate-400">{form.storeName.length}/{LIMITS.STORE_NAME}</span>
            </div>
            <input id="sn" required maxLength={LIMITS.STORE_NAME} value={form.storeName} onChange={(e) => setForm({ ...form, storeName: e.target.value })} className={inputCls} placeholder="เช่น โซลาร์ไทย สโตร์" />
          </div>
          <div>
            <div className="flex justify-between items-end">
              <label htmlFor="sd" className="font-bold text-slate-700">คำอธิบายร้าน</label>
              <span className="text-[10px] text-slate-400">{form.storeDescription.length}/{LIMITS.STORE_DESC}</span>
            </div>
            <textarea id="sd" rows={4} maxLength={LIMITS.STORE_DESC} value={form.storeDescription} onChange={(e) => setForm({ ...form, storeDescription: e.target.value })} className={inputCls} placeholder="แนะนำร้านของคุณให้ผู้ซื้อรู้จัก" />
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            สินค้าทุกชิ้นที่คุณลงขายจะอยู่ในร้านนี้ และแสดงในตลาดรวมด้วยโดยอัตโนมัติ
          </p>

          <Notice type="error">{error}</Notice>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="flex-1 bg-[#9bdadd] hover:bg-cyan-300 text-slate-900 font-bold py-3 rounded-full text-sm disabled:opacity-50">
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
            <Link href="/seller" className="flex-1 text-center bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-3 rounded-full text-sm">
              ยกเลิก
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
