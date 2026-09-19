'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Camera } from 'lucide-react';
import API, { errorMessage } from '@/lib/api';
import { Stars } from '@/components/StarRating';
import { ReviewItem } from '@/components/ReviewList';
import ImageViewer from '@/components/ImageViewer';
import { imageSrc } from '@/lib/image';

const Chip = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold border transition ${
      active ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
    }`}
  >
    {children}
  </button>
);

/**
 * ส่วนรีวิวแบบ Shopee: คะแนนเฉลี่ย + สัดส่วนแต่ละดาว + แกลเลอรีรูปจากผู้ซื้อจริง + ตัวกรอง (ดาว / มีรูป) + แบ่งหน้า
 *   endpoint = '/reviews/product/<id>' หรือ '/reviews/seller/<id>'
 */
export default function ReviewSection({ endpoint, title = 'รีวิว', emptyText = 'ยังไม่มีรีวิว', showGallery = true }) {
  const [star, setStar] = useState(0); // 0 = ทุกดาว
  const [onlyImages, setOnlyImages] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [viewer, setViewer] = useState(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const my = ++seq.current;
    setError('');
    try {
      const res = await API.get(endpoint, {
        params: { rating: star || undefined, withImages: onlyImages ? 1 : undefined, page },
      });
      if (my === seq.current) setData(res.data);
    } catch (err) {
      if (my === seq.current) setError(errorMessage(err));
    }
  }, [endpoint, star, onlyImages, page]);

  useEffect(() => {
    load();
  }, [load]);

  const changeStar = (v) => {
    setStar(v);
    setPage(1);
  };
  const toggleImages = () => {
    setOnlyImages((v) => !v);
    setPage(1);
  };

  if (!data) {
    return (
      <section className="space-y-2" aria-busy={!error}>
        <h2 className="font-bold text-sm text-slate-800">{title}</h2>
        <p className={`text-xs text-center py-4 ${error ? 'text-red-500' : 'text-slate-400'}`}>{error || 'กำลังโหลดรีวิว...'}</p>
      </section>
    );
  }

  const { rating, breakdown, withImages, photos, reviews, pages, total } = data;
  const photoUrls = photos.map((p) => p.url);

  return (
    <section className="space-y-3">
      <h2 className="font-bold text-sm text-slate-800">{title}</h2>

      {rating.count === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4">{emptyText}</p>
      ) : (
        <>
          {/* สรุปคะแนน */}
          <div className="flex items-center gap-4 bg-amber-50/60 rounded-2xl p-3">
            <div className="text-center shrink-0">
              <p className="text-3xl font-black text-slate-900 leading-none">{rating.avg.toFixed(1)}</p>
              <p className="text-[10px] text-slate-500 mb-1">จาก 5</p>
              <Stars value={rating.avg} size={13} />
              <p className="text-[10px] text-slate-500 mt-1">{rating.count} รีวิว</p>
            </div>
            <div className="flex-1 space-y-1" aria-label="สัดส่วนคะแนนรีวิว">
              {[5, 4, 3, 2, 1].map((n) => (
                <div key={n} className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <span className="w-3 text-right">{n}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(breakdown[n] / rating.count) * 100}%` }} />
                  </div>
                  <span className="w-5 text-right">{breakdown[n]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* แกลเลอรีรูปจากผู้ซื้อจริง */}
          {showGallery && photoUrls.length > 0 && (
            <div className="space-y-1.5">
              <p className="flex items-center gap-1 text-xs font-bold text-slate-700">
                <Camera size={14} className="text-cyan-600" /> รูปจากผู้ซื้อจริง
                <span className="font-normal text-slate-400">({withImages} รีวิวที่มีรูป)</span>
              </p>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {photoUrls.map((url, i) => (
                  <button key={`${url}-${i}`} type="button" onClick={() => setViewer(i)} aria-label={`ดูรูปจากผู้ซื้อที่ ${i + 1}`} className="w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-slate-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageSrc(url)} alt="" loading="lazy" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ตัวกรอง */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            <Chip active={star === 0 && !onlyImages} onClick={() => { setOnlyImages(false); changeStar(0); }}>
              ทั้งหมด ({rating.count})
            </Chip>
            {[5, 4, 3, 2, 1].map((n) => (
              <Chip key={n} active={star === n} onClick={() => changeStar(star === n ? 0 : n)}>
                {n} ★ ({breakdown[n]})
              </Chip>
            ))}
            <Chip active={onlyImages} onClick={toggleImages}>
              มีรูปภาพ ({withImages})
            </Chip>
          </div>

          {error && <p className="text-xs text-red-500 text-center">{error}</p>}

          {reviews.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">ไม่มีรีวิวที่ตรงกับตัวกรอง</p>
          ) : (
            <ul className="space-y-3">
              {reviews.map((r) => (
                <ReviewItem key={r.id} review={r} />
              ))}
            </ul>
          )}

          {pages > 1 && (
            <div className="flex items-center justify-center gap-3 text-xs font-bold text-slate-600">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="หน้าก่อนหน้า" className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center disabled:opacity-40">
                <ChevronLeft size={16} />
              </button>
              <span>
                หน้า {page} / {pages} <span className="font-normal text-slate-400">({total} รีวิว)</span>
              </span>
              <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="หน้าถัดไป" className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center disabled:opacity-40">
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

      <ImageViewer images={photoUrls} index={viewer} onIndex={setViewer} onClose={() => setViewer(null)} />
    </section>
  );
}
