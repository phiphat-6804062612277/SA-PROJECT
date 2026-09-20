'use client';
import { useEffect, useState } from 'react';
import { FileText, FileSpreadsheet, Download, ExternalLink, ImageOff } from 'lucide-react';
import { useBlobUrl, downloadFile, openFile, formatBytes, extOf, VIEWABLE_MIMES } from '@/lib/chat';

const ICONS = { xls: FileSpreadsheet, xlsx: FileSpreadsheet, csv: FileSpreadsheet }; // ที่เหลือใช้ FileText (แยกด้วยสีตามชนิดไฟล์)
const TONES = {
  pdf: 'bg-red-100 text-red-600',
  xls: 'bg-emerald-100 text-emerald-700',
  xlsx: 'bg-emerald-100 text-emerald-700',
  csv: 'bg-emerald-100 text-emerald-700',
  ppt: 'bg-orange-100 text-orange-600',
  pptx: 'bg-orange-100 text-orange-600',
  doc: 'bg-sky-100 text-sky-700',
  docx: 'bg-sky-100 text-sky-700',
};

/**
 * รูปที่แนบในแชต — แสดงตัวอย่าง (Preview) ในกล่องแชต กดแล้วเปิดดูรูปใหญ่
 *   onLoaded(url, objectUrl) แจ้งแม่เมื่อรูปโหลดเสร็จ (ให้หน้าดูรูปใหญ่เลื่อนดูรูปอื่นในห้องได้)
 */
export function ImageAttachment({ url, name, token, onOpen, onLoaded }) {
  const { src, error } = useBlobUrl(url, token);

  useEffect(() => {
    if (src && onLoaded) onLoaded(url, src);
  }, [src, url, onLoaded]);

  if (error) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-100 rounded-xl px-3 py-4 w-40">
        <ImageOff size={16} /> โหลดรูปไม่สำเร็จ
      </div>
    );
  }
  if (!src) return <div className="w-44 h-32 rounded-xl bg-slate-200 animate-pulse" aria-label="กำลังโหลดรูป" />;
  return (
    <button type="button" onClick={() => onOpen(url)} aria-label={`เปิดดูรูปใหญ่ ${name || ''}`} className="block cursor-zoom-in">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={name || 'รูปที่แนบ'} className="max-h-56 max-w-full rounded-xl object-cover" />
    </button>
  );
}

/** ไฟล์เอกสารที่แนบในแชต — การ์ดชื่อไฟล์/ขนาด พร้อมปุ่ม "เปิดดู" (PDF/TXT/CSV) และ "ดาวน์โหลด" */
export function FileAttachment({ url, name, mime, size, token }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const ext = extOf(name);
  const Icon = ICONS[ext] || FileText;
  const viewable = VIEWABLE_MIMES.includes(mime);

  const run = async (kind) => {
    setBusy(kind);
    setError('');
    try {
      if (kind === 'open') await openFile(url, name, token);
      else await downloadFile(url, name, token);
    } catch {
      setError('เปิดไฟล์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="w-56 max-w-full space-y-1.5">
      <div className="flex items-center gap-2.5">
        <span className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${TONES[ext] || 'bg-slate-100 text-slate-600'}`}>
          <Icon size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-slate-800 truncate" title={name}>{name || 'ไฟล์แนบ'}</p>
          <p className="text-[10px] text-slate-500">{ext ? ext.toUpperCase() : 'FILE'} · {formatBytes(size)}</p>
        </div>
      </div>
      <div className="flex gap-1.5">
        {viewable && (
          <button type="button" disabled={!!busy} onClick={() => run('open')} className="flex-1 inline-flex items-center justify-center gap-1 bg-white/80 hover:bg-white text-slate-700 text-[11px] font-bold py-1.5 rounded-full disabled:opacity-50">
            <ExternalLink size={12} /> {busy === 'open' ? 'กำลังเปิด...' : 'เปิดดู'}
          </button>
        )}
        <button type="button" disabled={!!busy} onClick={() => run('download')} className="flex-1 inline-flex items-center justify-center gap-1 bg-white/80 hover:bg-white text-slate-700 text-[11px] font-bold py-1.5 rounded-full disabled:opacity-50">
          <Download size={12} /> {busy === 'download' ? 'กำลังโหลด...' : 'ดาวน์โหลด'}
        </button>
      </div>
      {error && <p className="text-[10px] text-red-500" role="alert">{error}</p>}
    </div>
  );
}
