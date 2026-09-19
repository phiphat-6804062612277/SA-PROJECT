'use client';
import { useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import API, { errorMessage } from '@/lib/api';
import { LIMITS } from '@/lib/limits';
import { uploadImage, imageSrc } from '@/lib/image';
import { Stars, StarInput } from '@/components/StarRating';
import { useToast } from '@/components/Toast';

/**
 * กล่องรีวิวใต้คำสั่งซื้อที่สำเร็จแล้ว
 *   as="buyer"  → ผู้ซื้อรีวิวผู้ขาย (แนบรูปได้สูงสุด 4 รูป)     as="seller" → ผู้ขายรีวิวผู้ซื้อ
 * และแสดงรีวิวที่อีกฝ่ายเขียนถึงเรา (ถ้ามี)
 */
export default function ReviewBox({ order, as, onDone }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [images, setImages] = useState([]); // path รูปที่อัปโหลดแล้ว
  const [uploading, setUploading] = useState(0); // จำนวนรูปที่กำลังอัปโหลด
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  if (order.status !== 'COMPLETED') return null;
  const other = as === 'buyer' ? 'ผู้ขาย' : 'ผู้ซื้อ';
  const canAttach = as === 'buyer';

  const pickFiles = async (e) => {
    const files = [...(e.target.files || [])].slice(0, Math.max(0, LIMITS.REVIEW_IMAGES - images.length - uploading));
    e.target.value = '';
    if (!files.length) return;
    setError('');
    setUploading((n) => n + files.length);
    for (const file of files) {
      try {
        const { url } = await uploadImage(file, 'review');
        setImages((list) => (list.length < LIMITS.REVIEW_IMAGES ? [...list, url] : list));
      } catch (err) {
        setError(err?.response ? errorMessage(err) : err?.message || 'อัปโหลดรูปไม่สำเร็จ');
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!rating) return setError('กรุณาเลือกจำนวนดาว');
    if (uploading > 0) return setError('กรุณารอให้อัปโหลดรูปเสร็จก่อน');
    setSaving(true);
    setError('');
    try {
      await API.post('/reviews', { orderId: order._id, rating, comment, ...(canAttach ? { images } : {}) });
      toast.success('ขอบคุณสำหรับรีวิว');
      setOpen(false);
      onDone?.();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-t pt-2 space-y-2">
      {order.myReview ? (
        <div className="bg-slate-50 rounded-xl p-2.5 space-y-1">
          <p className="text-[10px] font-bold text-slate-500">รีวิว{other}ของคุณ</p>
          <Stars value={order.myReview.rating} size={14} />
          {order.myReview.comment && <p className="text-xs text-slate-600 text-wrap-safe">{order.myReview.comment}</p>}
          {order.myReview.images?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {order.myReview.images.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={url} src={imageSrc(url)} alt="รูปรีวิวของคุณ" loading="lazy" className="w-14 h-14 rounded-lg object-cover bg-slate-200" />
              ))}
            </div>
          )}
        </div>
      ) : open ? (
        <form onSubmit={submit} className="bg-slate-50 rounded-xl p-3 space-y-2">
          <p className="text-xs font-bold text-slate-700">ให้คะแนน{other}</p>
          <StarInput value={rating} onChange={setRating} />
          <textarea
            aria-label="ความคิดเห็น"
            rows={3}
            maxLength={LIMITS.REVIEW}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="เล่าประสบการณ์ของคุณ (ไม่บังคับ)"
            className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none focus:border-cyan-500"
          />
          <p className="text-[10px] text-slate-400 text-right">{comment.length}/{LIMITS.REVIEW}</p>

          {canAttach && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold text-slate-600">
                แนบรูปสินค้า <span className="font-normal text-slate-400">({images.length}/{LIMITS.REVIEW_IMAGES})</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {images.map((url) => (
                  <div key={url} className="relative w-16 h-16">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageSrc(url)} alt="รูปที่แนบ" className="w-full h-full rounded-lg object-cover bg-slate-200" />
                    <button type="button" onClick={() => setImages((l) => l.filter((u) => u !== url))} aria-label="ลบรูปนี้" className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center">
                      <X size={12} />
                    </button>
                  </div>
                ))}
                {Array.from({ length: uploading }).map((_, i) => (
                  <div key={`u${i}`} className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                    <Loader2 size={18} className="animate-spin" />
                  </div>
                ))}
                {images.length + uploading < LIMITS.REVIEW_IMAGES && (
                  <button type="button" onClick={() => fileRef.current?.click()} aria-label="เพิ่มรูปประกอบรีวิว" className="w-16 h-16 rounded-lg border-2 border-dashed border-cyan-300 bg-cyan-50 text-cyan-700 flex flex-col items-center justify-center text-[10px] font-bold hover:bg-cyan-100">
                    <ImagePlus size={18} /> เพิ่มรูป
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" tabIndex={-1} onChange={pickFiles} aria-label="เลือกรูปประกอบรีวิว" />
            </div>
          )}
          {error && <p className="text-xs text-red-500 font-semibold" role="alert">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving || uploading > 0} className="flex-1 bg-[#9bdadd] hover:bg-cyan-300 text-slate-900 font-bold py-2 rounded-full text-xs disabled:opacity-50">
              {saving ? 'กำลังส่ง...' : 'ส่งรีวิว'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="px-4 bg-white border border-slate-200 text-slate-600 font-bold py-2 rounded-full text-xs">
              ยกเลิก
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setOpen(true)} className="w-full bg-amber-50 border border-amber-200 text-amber-700 font-bold py-2 rounded-full text-xs">
          ★ เขียนรีวิว{other}
        </button>
      )}

      {order.reviewOfMe && (
        <div className="bg-cyan-50 rounded-xl p-2.5 space-y-1">
          <p className="text-[10px] font-bold text-cyan-700">{other}รีวิวคุณ</p>
          <Stars value={order.reviewOfMe.rating} size={14} />
          {order.reviewOfMe.comment && <p className="text-xs text-slate-600 text-wrap-safe">{order.reviewOfMe.comment}</p>}
        </div>
      )}
    </div>
  );
}
