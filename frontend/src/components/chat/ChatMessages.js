'use client';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Avatar from '@/components/Avatar';
import ImageViewer from '@/components/ImageViewer';
import { ImageAttachment, FileAttachment } from '@/components/chat/ChatAttachment';
import { dayLabel, timeText } from '@/lib/chat';

const ROLE_LABEL = { buyer: 'ผู้ซื้อ', seller: 'ผู้ขาย', admin: 'Admin' };

/**
 * รายการข้อความในห้องแชต (ใช้ร่วมกันทั้งแชตซื้อขาย / ติดต่อ Admin / ข้อพิพาท)
 *   messages: [{ id, mine, senderRole, senderName, senderAvatarUrl, messageType: 'TEXT'|'IMAGE'|'FILE', text, fileUrl, fileName, fileMime, fileSize, createdAt }]
 *   token: โทเคนเฉพาะกิจสำหรับดึงไฟล์แนบ (หน้า /suspended) — ไม่ส่ง = ใช้โทเคนล็อกอินปกติ
 *   showSender: แสดงชื่อ + บทบาทของผู้ส่งเหนือข้อความ (ห้องที่มีหลายฝ่าย เช่น ข้อพิพาท / ซัพพอร์ต)
 *   roleStyle: (ไม่บังคับ) สีพื้นของกล่องข้อความตามบทบาท เช่น { buyer: 'bg-cyan-50 ...' }
 * กล่องนี้เลื่อนเองได้ (ให้แม่กำหนดความสูงผ่าน className) — เลื่อนลงล่างสุดเมื่อมีข้อความใหม่ถ้าผู้ใช้อยู่ท้ายห้อง/เป็นข้อความของตัวเอง
 */
export default function ChatMessages({
  messages,
  token,
  showSender = false,
  roleStyle,
  emptyText = 'ยังไม่มีข้อความ เริ่มพิมพ์ทักทายได้เลย',
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  className = '',
}) {
  const boxRef = useRef(null);
  const stick = useRef(true); // ผู้ใช้อยู่ท้ายห้องอยู่หรือไม่
  const lastId = useRef(null);
  const firstId = useRef(null);
  const prevHeight = useRef(0);
  const [loaded, setLoaded] = useState({}); // url → object URL ของรูปที่โหลดแล้ว (ใช้กับหน้าดูรูปใหญ่)
  const [viewer, setViewer] = useState(null); // index ในรายการรูป

  const onLoaded = useCallback((url, src) => setLoaded((prev) => (prev[url] === src ? prev : { ...prev, [url]: src })), []);

  const images = useMemo(
    () => messages.filter((m) => m.messageType === 'IMAGE' && loaded[m.fileUrl]).map((m) => ({ url: m.fileUrl, src: loaded[m.fileUrl], name: m.fileName })),
    [messages, loaded]
  );
  const openImage = (url) => {
    const i = images.findIndex((x) => x.url === url);
    if (i >= 0) setViewer(i);
  };

  const onScroll = () => {
    const el = boxRef.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
  };

  // ข้อความใหม่ท้ายห้อง → เลื่อนลง / โหลดข้อความเก่าเพิ่มด้านบน → คงตำแหน่งที่กำลังอ่านไว้
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const last = messages[messages.length - 1];
    const first = messages[0];
    const newLast = (last?.id ?? null) !== lastId.current;
    const prepended = !newLast && lastId.current !== null && (first?.id ?? null) !== firstId.current;
    if (prepended) {
      el.scrollTop += el.scrollHeight - prevHeight.current;
    } else if (newLast && (stick.current || last?.mine || lastId.current === null)) {
      el.scrollTop = el.scrollHeight;
    }
    lastId.current = last?.id ?? null;
    firstId.current = first?.id ?? null;
    prevHeight.current = el.scrollHeight;
  }, [messages]);

  // รูปโหลดเสร็จทำให้ความสูงเพิ่ม — ถ้าอยู่ท้ายห้องให้เลื่อนตามลงไป
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
    if (el) prevHeight.current = el.scrollHeight;
  }, [loaded]);

  let lastDay = '';
  return (
    <div ref={boxRef} onScroll={onScroll} className={`overflow-y-auto ${className}`} role="log" aria-live="polite" aria-label="ข้อความในห้องสนทนา">
      {hasMore && (
        <div className="text-center pb-2">
          <button type="button" onClick={onLoadMore} disabled={loadingMore} className="text-[11px] font-bold text-cyan-700 bg-white/80 hover:bg-white rounded-full px-3 py-1.5 disabled:opacity-50">
            {loadingMore ? 'กำลังโหลด...' : 'โหลดข้อความก่อนหน้า'}
          </button>
        </div>
      )}
      {messages.length === 0 ? (
        <p className="text-center text-[11px] text-slate-400 py-10">{emptyText}</p>
      ) : (
        <ul className="space-y-2">
          {messages.map((m) => {
            const day = dayLabel(m.createdAt);
            const showDay = day !== lastDay;
            lastDay = day;
            const hasText = !!m.text;
            const bubble = roleStyle?.[m.senderRole]
              ? `border ${roleStyle[m.senderRole]}`
              : m.mine
                ? 'bg-[#9bdadd] text-slate-900'
                : 'bg-white text-slate-800 border border-slate-100';
            return (
              <li key={m.id}>
                {showDay && (
                  <div className="text-center my-2">
                    <span className="text-[10px] font-bold text-slate-500 bg-white/70 rounded-full px-2.5 py-0.5">{day}</span>
                  </div>
                )}
                <div className={`flex items-end gap-1.5 ${m.mine ? 'flex-row-reverse' : ''}`}>
                  {!m.mine && <Avatar src={m.senderAvatarUrl} name={m.senderName} size={28} />}
                  <div className={`flex flex-col min-w-0 max-w-[80%] ${m.mine ? 'items-end' : 'items-start'}`}>
                    {showSender && !m.mine && (
                      <p className="text-[10px] font-bold text-slate-500 mb-0.5 px-1 truncate max-w-full">
                        {m.senderName} <span className="font-normal">({ROLE_LABEL[m.senderRole] || m.senderRole})</span>
                      </p>
                    )}
                    <div className={`rounded-2xl px-3 py-2 space-y-1.5 min-w-0 ${m.mine ? 'rounded-br-md' : 'rounded-bl-md'} ${bubble}`}>
                      {m.messageType === 'IMAGE' && m.fileUrl && (
                        <ImageAttachment url={m.fileUrl} name={m.fileName} token={token} onOpen={openImage} onLoaded={onLoaded} />
                      )}
                      {m.messageType === 'FILE' && m.fileUrl && (
                        <FileAttachment url={m.fileUrl} name={m.fileName} mime={m.fileMime} size={m.fileSize} token={token} />
                      )}
                      {hasText && <p className="text-xs leading-relaxed text-wrap-safe">{m.text}</p>}
                    </div>
                    <span className="text-[9px] text-slate-400 mt-0.5 px-1">
                      {m.mine && showSender ? `${m.senderName} · ` : ''}
                      {timeText(m.createdAt)}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ImageViewer images={images.map((x) => x.src)} names={images.map((x) => x.name)} index={viewer} onIndex={setViewer} onClose={() => setViewer(null)} />
    </div>
  );
}
