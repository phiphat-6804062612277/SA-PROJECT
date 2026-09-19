'use client';
import { useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { imageSrc } from '@/lib/image';

/**
 * ดูรูปขนาดใหญ่เต็มจอ (Lightbox) — เลื่อนซ้าย/ขวาด้วยปุ่มหรือลูกศรคีย์บอร์ด, Esc เพื่อปิด
 *   <ImageViewer images={[url,...]} index={i} onIndex={setI} onClose={() => setI(null)} />
 */
export default function ImageViewer({ images, index, onIndex, onClose }) {
  const total = images.length;
  const open = index !== null && index !== undefined && !!images[index];

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1);
      else if (e.key === 'ArrowRight' && index < total - 1) onIndex(index + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, index, total, onIndex, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-center" role="dialog" aria-modal="true" aria-label="ดูรูปภาพ">
      <div className="relative w-full max-w-md h-full bg-black/90 flex items-center justify-center">
        <button className="absolute inset-0 cursor-zoom-out" aria-label="ปิด" onClick={onClose} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageSrc(images[index])} alt={`รูปที่ ${index + 1} จาก ${total}`} className="relative max-h-[85vh] max-w-full object-contain pointer-events-none" />

        <button onClick={onClose} aria-label="ปิด" className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30">
          <X size={20} />
        </button>
        {total > 1 && (
          <>
            <span className="absolute top-4 left-4 text-white/90 text-xs font-bold">
              {index + 1} / {total}
            </span>
            {index > 0 && (
              <button onClick={() => onIndex(index - 1)} aria-label="รูปก่อนหน้า" className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30">
                <ChevronLeft size={22} />
              </button>
            )}
            {index < total - 1 && (
              <button onClick={() => onIndex(index + 1)} aria-label="รูปถัดไป" className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30">
                <ChevronRight size={22} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
