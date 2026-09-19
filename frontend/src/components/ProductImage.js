'use client';
import { useState } from 'react';
import { Sun } from 'lucide-react';

// รูปสินค้า: ถ้าไม่มีรูปหรือโหลดไม่ได้ จะแสดงไอคอนแทน
export default function ProductImage({ src, alt = '', className = '', iconSize = 32 }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={`bg-slate-200 flex items-center justify-center text-slate-400 ${className}`}>
        <Sun size={iconSize} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} onError={() => setFailed(true)} className={`object-cover ${className}`} />
  );
}
