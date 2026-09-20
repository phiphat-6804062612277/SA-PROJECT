'use client';
import { useEffect, useRef, useState } from 'react';
import { Paperclip, Send, X, FileText, Loader2 } from 'lucide-react';
import { ATTACH_ACCEPT, ATTACH_HINT, IMAGE_TYPES, formatBytes, validateAttachment } from '@/lib/chat';

/**
 * ช่องพิมพ์ข้อความ + ปุ่มแนบไฟล์/รูปภาพ (ใช้ร่วมกันทุกแชต: ซื้อขาย / ติดต่อ Admin / ข้อพิพาท)
 *   onSend({ text, fileUrl })  ส่งข้อความ (throw ได้ — ข้อความ error จะแสดงใต้ช่องพิมพ์และเก็บสิ่งที่พิมพ์ไว้ให้ส่งใหม่)
 *   upload(file) → { url, name, mime, size, kind }  อัปโหลดไฟล์ทันทีที่เลือก (แสดง Preview ก่อนกดส่ง)
 *   disabled + disabledText  ปิดการส่ง (เช่น อีกฝ่ายถูกระงับ / ข้อพิพาทตัดสินแล้ว)
 *   Enter = ส่ง, Shift+Enter = ขึ้นบรรทัดใหม่, วางรูปจากคลิปบอร์ดได้
 */
export default function Composer({
  onSend,
  upload,
  disabled = false,
  disabledText = '',
  maxLength = 1000,
  placeholder = 'พิมพ์ข้อความ...',
  className = '',
}) {
  const [text, setText] = useState('');
  const [pending, setPending] = useState(null); // { file, preview, status: 'uploading'|'ready'|'error', info, error }
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const previewRef = useRef('');

  // คืนหน่วยความจำของรูปตัวอย่างเมื่อปิดหน้า
  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    []
  );

  const clearPending = () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = '';
    setPending(null);
  };

  const pick = async (file) => {
    if (!file || !upload) return;
    setError('');
    const problem = validateAttachment(file);
    if (problem) {
      setError(problem);
      return;
    }
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const preview = IMAGE_TYPES.includes(file.type) ? URL.createObjectURL(file) : '';
    previewRef.current = preview;
    setPending({ file, preview, status: 'uploading', info: null, error: '' });
    try {
      const info = await upload(file);
      setPending((cur) => (cur && cur.file === file ? { ...cur, status: 'ready', info } : cur));
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'อัปโหลดไฟล์ไม่สำเร็จ';
      setPending((cur) => (cur && cur.file === file ? { ...cur, status: 'error', error: message } : cur));
    }
  };

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // เลือกไฟล์เดิมซ้ำได้
    pick(file);
  };

  const onPaste = (e) => {
    const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'));
    if (file) {
      e.preventDefault();
      pick(file);
    }
  };

  const canSend = !disabled && !sending && (text.trim() || pending?.status === 'ready') && pending?.status !== 'uploading' && pending?.status !== 'error';

  const submit = async (e) => {
    e?.preventDefault();
    if (!canSend) return;
    setSending(true);
    setError('');
    try {
      await onSend({ text: text.trim(), fileUrl: pending?.status === 'ready' ? pending.info.url : '' });
      setText('');
      clearPending();
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'ส่งข้อความไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
      // ไฟล์แนบถูกใช้ไปแล้ว/หมดอายุ (เช่น ส่งสำเร็จแต่ตอบกลับหาย) — ล้างไฟล์ที่ค้างเพื่อไม่ให้กดส่งซ้ำแล้วล้มเหลวตลอด
      if (pending && err?.response?.status === 400 && /ไฟล์แนบ/.test(message)) clearPending();
      setError(message);
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    // ไม่ส่งตอนกำลังเลือกคำจาก IME (พิมพ์ภาษาไทย/จีน/ญี่ปุ่น)
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  if (disabled) {
    return (
      <div className={`border-t bg-white px-4 py-3 text-center text-[11px] text-slate-500 ${className}`}>
        {disabledText || 'ไม่สามารถส่งข้อความในห้องนี้ได้'}
      </div>
    );
  }

  return (
    <div className={`border-t bg-white px-3 py-2 space-y-1.5 ${className}`}>
      {error && <p className="text-[11px] font-semibold text-red-500 px-1" role="alert">{error}</p>}

      {pending && (
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2">
          {pending.preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pending.preview} alt="ตัวอย่างรูปที่จะส่ง" className="w-12 h-12 rounded-lg object-cover shrink-0" />
          ) : (
            <span className="w-12 h-12 rounded-lg bg-slate-200 text-slate-500 flex items-center justify-center shrink-0">
              <FileText size={20} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-700 truncate">{pending.file.name}</p>
            <p className={`text-[10px] ${pending.status === 'error' ? 'text-red-500' : 'text-slate-400'}`}>
              {pending.status === 'uploading' && (
                <span className="inline-flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> กำลังอัปโหลด...</span>
              )}
              {pending.status === 'ready' && `พร้อมส่ง · ${formatBytes(pending.info?.size || pending.file.size)}`}
              {pending.status === 'error' && pending.error}
            </p>
          </div>
          <button type="button" onClick={clearPending} aria-label="ยกเลิกไฟล์แนบ" className="p-1.5 rounded-full text-slate-400 hover:bg-slate-200">
            <X size={16} />
          </button>
        </div>
      )}

      <form onSubmit={submit} className="flex items-end gap-2">
        {upload && (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              aria-label="แนบไฟล์หรือรูปภาพ"
              title={ATTACH_HINT}
              disabled={sending}
              className="shrink-0 p-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-40"
            >
              <Paperclip size={18} />
            </button>
            <input ref={inputRef} type="file" accept={ATTACH_ACCEPT} onChange={onFileChange} className="hidden" tabIndex={-1} aria-hidden="true" />
          </>
        )}
        <textarea
          aria-label="พิมพ์ข้อความ"
          rows={Math.min(4, Math.max(1, text.split('\n').length))}
          value={text}
          maxLength={maxLength}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          placeholder={placeholder}
          className="flex-1 min-w-0 resize-none px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none focus:border-cyan-500 focus:bg-white text-wrap-safe"
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label="ส่งข้อความ"
          className="shrink-0 bg-[#9bdadd] hover:bg-cyan-300 text-slate-900 p-2.5 rounded-full disabled:opacity-40"
        >
          {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </form>
      {text.length > maxLength * 0.8 && <p className="text-[10px] text-slate-400 text-right px-1">{text.length}/{maxLength}</p>}
    </div>
  );
}
