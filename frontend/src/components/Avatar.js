'use client';
import { useState } from 'react';
import { imageSrc } from '@/lib/image';

// สีพื้นหลังของตัวอักษรย่อ (เลือกจากชื่อ ให้คนเดิมได้สีเดิมเสมอ)
const TONES = ['bg-cyan-200 text-cyan-900', 'bg-emerald-200 text-emerald-900', 'bg-amber-200 text-amber-900', 'bg-violet-200 text-violet-900', 'bg-rose-200 text-rose-900', 'bg-sky-200 text-sky-900'];
const toneOf = (name = '') => TONES[[...name].reduce((s, c) => s + c.codePointAt(0), 0) % TONES.length];

/**
 * รูปโปรไฟล์วงกลม — ไม่มีรูป/โหลดไม่ได้ จะแสดงตัวอักษรแรกของชื่อแทน
 *   <Avatar src={user.avatarUrl} name={user.name} size={40} />
 */
export default function Avatar({ src, name = '', size = 40, className = '', ring = false }) {
  const [failedSrc, setFailedSrc] = useState('');
  const url = imageSrc(src);
  const showImage = url && failedSrc !== url;
  const initial = (String(name).trim()[0] || '?').toUpperCase();
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.42)) };

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold select-none ${
        showImage ? 'bg-slate-100' : toneOf(name)
      } ${ring ? 'ring-2 ring-white' : ''} ${className}`}
      style={style}
      aria-hidden={showImage ? undefined : 'true'}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name ? `รูปโปรไฟล์ ${name}` : 'รูปโปรไฟล์'} onError={() => setFailedSrc(url)} className="h-full w-full object-cover" />
      ) : (
        initial
      )}
    </span>
  );
}
