'use client';
import { useState } from 'react';
import Avatar from '@/components/Avatar';
import ImageViewer from '@/components/ImageViewer';
import TrustBadge from '@/components/TrustBadge';
import { Stars, RatingSummary } from '@/components/StarRating';
import { imageSrc } from '@/lib/image';

// การ์ดรีวิว 1 รายการ: รูป+ชื่อผู้รีวิว + ป้ายความน่าเชื่อถือ (ผู้ซื้อ) + ดาว + สินค้า + ข้อความ + รูปประกอบ
export function ReviewItem({ review: r }) {
  const [viewer, setViewer] = useState(null);
  const images = r.images || [];
  return (
    <li className="bg-slate-50 rounded-2xl p-3 space-y-2">
      <div className="flex items-start gap-2.5">
        <Avatar src={r.reviewer?.avatarUrl} name={r.reviewer?.name || 'ผู้ใช้'} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-800 truncate">{r.reviewer?.name || 'ผู้ใช้'}</span>
            <span className="text-[10px] text-slate-400 shrink-0">{new Date(r.createdAt).toLocaleDateString('th-TH')}</span>
          </div>
          {r.reviewer?.trust && (
            <div className="mt-0.5">
              <TrustBadge trust={r.reviewer.trust} compact />
            </div>
          )}
        </div>
      </div>

      <Stars value={r.rating} size={13} />
      {r.products?.length > 0 && (
        <p className="text-[10px] text-slate-400 truncate">สินค้า: {r.products.map((p) => p.name).join(', ')}</p>
      )}
      {r.comment && <p className="text-xs text-slate-700 text-wrap-safe">{r.comment}</p>}

      {images.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {images.map((url, i) => (
            <button key={url} type="button" onClick={() => setViewer(i)} aria-label={`ดูรูปรีวิวที่ ${i + 1}`} className="w-16 h-16 rounded-lg overflow-hidden bg-slate-200 border border-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageSrc(url)} alt="" loading="lazy" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
      <ImageViewer images={images} index={viewer} onIndex={setViewer} onClose={() => setViewer(null)} />
    </li>
  );
}

// รายการรีวิวแบบง่าย (ใช้ในหน้าโปรไฟล์) — หน้าสินค้า/หน้าร้านใช้ ReviewSection ที่มีตัวกรอง/แกลเลอรี
export default function ReviewList({ rating, reviews, title = 'รีวิว', emptyText = 'ยังไม่มีรีวิว' }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold text-sm text-slate-800">{title}</h2>
        <RatingSummary rating={rating} emptyText="" />
      </div>

      {reviews.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4">{emptyText}</p>
      ) : (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <ReviewItem key={r.id} review={r} />
          ))}
        </ul>
      )}
    </section>
  );
}
