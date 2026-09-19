'use client';
import { useRef, useState } from 'react';
import { Camera, ImagePlus, Trash2, Loader2 } from 'lucide-react';
import Avatar from '@/components/Avatar';
import { uploadImage, imageSrc } from '@/lib/image';
import { errorMessage } from '@/lib/api';

/**
 * ช่องอัปโหลดรูปเดี่ยว (ย่อรูปบนเบราว์เซอร์ก่อนส่ง) — ค่า value เป็น path ของรูป เช่น /api/images/<id>
 *   shape="avatar" → วงกลม (รูปโปรไฟล์)    shape="logo" → สี่เหลี่ยมมุมมน (โลโก้ร้าน)    shape="banner" → แถบกว้าง (ปกร้าน)
 * เรียก onChange(url) เมื่ออัปโหลดสำเร็จ และ onChange('') เมื่อกดลบ — ผู้ใช้ต้องกด "บันทึก" ที่หน้าแม่เอง
 */
export default function ImageUploader({ kind, shape = 'avatar', value, onChange, name = '', disabled = false, label, hint }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pick = () => !busy && !disabled && inputRef.current?.click();

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // เลือกไฟล์เดิมซ้ำได้
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const { url } = await uploadImage(file, kind);
      onChange(url);
    } catch (err) {
      setError(err?.response ? errorMessage(err) : err?.message || 'อัปโหลดรูปไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const input = (
    <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} onChange={onFile} aria-label={label || 'เลือกรูปภาพ'} />
  );

  const status = (
    <>
      {error && (
        <p className="text-[11px] font-semibold text-red-500 mt-1" role="alert">
          {error}
        </p>
      )}
      {hint && !error && <p className="text-[10px] text-slate-400 mt-1">{hint}</p>}
    </>
  );

  if (shape === 'avatar') {
    return (
      <div className="flex flex-col items-center">
        <div className="relative">
          <Avatar src={value} name={name} size={88} ring />
          {busy && (
            <span className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center text-white">
              <Loader2 size={22} className="animate-spin" />
            </span>
          )}
          <button
            type="button"
            onClick={pick}
            disabled={busy || disabled}
            aria-label={value ? 'เปลี่ยนรูปโปรไฟล์' : 'เพิ่มรูปโปรไฟล์'}
            className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[#9bdadd] text-slate-900 shadow flex items-center justify-center hover:bg-cyan-300 disabled:opacity-50"
          >
            <Camera size={16} />
          </button>
        </div>
        {value && !busy && (
          <button type="button" onClick={() => onChange('')} disabled={disabled} className="mt-2 text-[11px] font-bold text-red-500 hover:underline">
            ลบรูป
          </button>
        )}
        {input}
        {status}
      </div>
    );
  }

  const isBanner = shape === 'banner';
  return (
    <div>
      {label && <p className="text-xs font-bold text-slate-700 mb-1">{label}</p>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={pick}
          disabled={busy || disabled}
          aria-label={value ? `เปลี่ยน${label || 'รูป'}` : `เพิ่ม${label || 'รูป'}`}
          className={`relative overflow-hidden border-2 border-dashed border-cyan-300 bg-cyan-50 text-cyan-700 flex items-center justify-center hover:bg-cyan-100 disabled:opacity-60 ${
            isBanner ? 'w-full aspect-[3/1] rounded-2xl' : 'w-20 h-20 rounded-2xl shrink-0'
          }`}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageSrc(value)} alt={label || 'รูปที่เลือก'} className="w-full h-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-1 text-[11px] font-bold">
              <ImagePlus size={isBanner ? 24 : 20} /> เพิ่มรูป
            </span>
          )}
          {busy && (
            <span className="absolute inset-0 bg-black/40 flex items-center justify-center text-white">
              <Loader2 size={22} className="animate-spin" />
            </span>
          )}
        </button>
        {!isBanner && (
          <div className="flex-1 min-w-0">
            <button type="button" onClick={pick} disabled={busy || disabled} className="text-xs font-bold text-cyan-700 hover:underline">
              {value ? 'เปลี่ยนรูป' : 'เลือกรูป'}
            </button>
            {value && (
              <button type="button" onClick={() => onChange('')} disabled={busy || disabled} className="ml-3 text-xs font-bold text-red-500 hover:underline">
                <Trash2 size={12} className="inline -mt-0.5 mr-0.5" />
                ลบ
              </button>
            )}
            {status}
          </div>
        )}
      </div>
      {isBanner && (
        <div className="flex items-center justify-between mt-1.5">
          <div>{status}</div>
          {value && (
            <button type="button" onClick={() => onChange('')} disabled={busy || disabled} className="text-xs font-bold text-red-500 hover:underline shrink-0">
              <Trash2 size={12} className="inline -mt-0.5 mr-0.5" />
              ลบรูปปก
            </button>
          )}
        </div>
      )}
      {input}
    </div>
  );
}
