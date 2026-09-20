'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Ban, Store, ShieldCheck, CircleAlert, ExternalLink, CheckCircle2 } from 'lucide-react';
import API, { errorMessage } from '@/lib/api';
import { authOpts, uploadChatAttachment } from '@/lib/chat';
import { LIMITS } from '@/lib/limits';
import ChatMessages from '@/components/chat/ChatMessages';
import Composer from '@/components/chat/Composer';
import ProductImage from '@/components/ProductImage';
import Loading from '@/components/Loading';
import Notice from '@/components/Notice';
import { useNotifications } from '@/components/NotificationProvider';

const POLL_MS = 4000;

// รวมข้อความใหม่เข้ารายการ: กันซ้ำด้วย id และเรียงตามลำดับเวลา (id เรียงตามเวลาสร้าง)
function mergeMessages(prev, incoming) {
  const seen = new Set(prev.map((m) => m.id));
  const add = incoming.filter((m) => !seen.has(m.id));
  if (!add.length) return prev;
  return [...prev, ...add].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

const Box = ({ tone = 'red', icon: Icon, children }) => {
  const tones = {
    red: 'bg-red-50 border-red-200 text-red-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    green: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    slate: 'bg-white border-slate-200 text-slate-700',
  };
  return (
    <div className={`border rounded-xl px-3 py-2 text-[11px] flex gap-2 items-start ${tones[tone]}`}>
      {Icon && <Icon size={14} className="shrink-0 mt-0.5" />}
      <div className="min-w-0 flex-1 space-y-1 text-wrap-safe">{children}</div>
    </div>
  );
};

/**
 * ห้องสนทนา 1 ห้อง (แชตซื้อขาย Buyer ↔ Store, หรือแชตติดต่อ Admin / ยื่นอุทธรณ์) — โหลดข้อความ, ส่งข้อความ/ไฟล์แนบ, ดึงข้อความใหม่ทุก 4 วินาที
 *   id: รหัสห้อง   token: (ไม่บังคับ) โทเคนเฉพาะกิจ เช่น appeal token ในหน้า /suspended
 *   embedded: แสดงเป็นการ์ดความสูงคงที่ในหน้า (ไม่ใช่เต็มจอ)   onMeta(conversation): แจ้งแม่เมื่อโหลดข้อมูลห้องได้/เปลี่ยน
 */
export default function ChatRoom({ id, token, embedded = false, onMeta }) {
  const { refresh: refreshNotifications } = useNotifications();
  const [conv, setConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [expired, setExpired] = useState(false); // โทเคนอุทธรณ์ใช้ไม่ได้แล้ว (ถูกปลดระงับ/หมดอายุ)
  const lastId = useRef(null);
  const onMetaRef = useRef(onMeta);
  useEffect(() => {
    onMetaRef.current = onMeta;
  }, [onMeta]);

  // อัปเดตข้อมูลห้องเฉพาะเมื่อเปลี่ยนจริง (ทุกครั้งที่ poll จะได้ข้อมูลห้องกลับมาด้วย — ไม่ต้อง render ซ้ำถ้าเหมือนเดิม)
  const metaKey = useRef('');
  const applyMeta = useCallback((c) => {
    const key = JSON.stringify(c);
    if (key === metaKey.current) return;
    metaKey.current = key;
    setConv(c);
    onMetaRef.current?.(c);
  }, []);

  // โหลดครั้งแรก
  useEffect(() => {
    let alive = true;
    lastId.current = null;
    API.get(`/chat/conversations/${id}`, authOpts(token))
      .then((res) => {
        if (!alive) return;
        setMessages(res.data.messages);
        setHasMore(res.data.hasMore);
        lastId.current = res.data.messages[res.data.messages.length - 1]?.id || null;
        applyMeta(res.data.conversation);
        setError('');
        refreshNotifications(); // เปิดอ่านแล้ว → Badge ข้อความใหม่ลดลง
      })
      .catch((err) => alive && setError(errorMessage(err, 'ไม่สามารถเปิดห้องสนทนานี้ได้')));
    return () => {
      alive = false;
    };
  }, [id, token, applyMeta, refreshNotifications]);

  // ดึงเฉพาะข้อความที่ใหม่กว่าทุก 4 วินาที (หยุดเมื่อแท็บถูกซ่อน)
  const poll = useCallback(async () => {
    try {
      const after = lastId.current ? `?after=${lastId.current}` : '';
      const res = await API.get(`/chat/conversations/${id}${after}`, authOpts(token));
      // ห้องว่างมาก่อน (lastId = null) จะได้ข้อความทั้งหมดในหน้าแรก — ทั้งสองแบบต่อท้ายรายการโดยกันซ้ำ
      const fresh = res.data.messages;
      if (fresh.length) {
        setMessages((prev) => mergeMessages(prev, fresh));
        lastId.current = fresh[fresh.length - 1].id;
        refreshNotifications();
      }
      applyMeta(res.data.conversation);
    } catch (err) {
      // หน้า /suspended: โทเคนอุทธรณ์ใช้ได้เฉพาะตอนยังถูกแบน — 401 = ถูกปลดระงับแล้วหรือหมดอายุ (หยุดดึงข้อความและแจ้งผู้ใช้)
      if (token && err?.response?.status === 401) setExpired(true);
      /* ข้อผิดพลาดอื่น = เครือข่ายสะดุดชั่วคราว รอบหน้าลองใหม่ */
    }
  }, [id, token, applyMeta, refreshNotifications]);

  const ready = conv !== null && !expired;
  useEffect(() => {
    if (!ready) return undefined;
    const tick = () => {
      if (!document.hidden) poll();
    };
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
    };
  }, [ready, poll]);

  // ออกจากห้อง → รีเฟรช Badge อีกครั้ง
  useEffect(() => () => refreshNotifications(), [refreshNotifications]);

  const loadMore = async () => {
    if (!messages.length || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await API.get(`/chat/conversations/${id}?before=${messages[0].id}`, authOpts(token));
      setMessages((prev) => mergeMessages(prev, res.data.messages));
      setHasMore(res.data.hasMore);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  };

  const send = async ({ text, fileUrl }) => {
    const res = await API.post(`/chat/conversations/${id}/messages`, { text, fileUrl }, authOpts(token));
    setMessages((prev) => mergeMessages(prev, [res.data.message]));
    // ไม่ขยับ lastId ตรงนี้: ถ้าอีกฝ่ายส่งมาคั่นระหว่างรอบ poll รอบถัดไป (after = id ล่าสุดที่ดึงมา) จะยังได้ข้อความนั้นครบ (ข้อความของเราซ้ำกันไว้ด้วย id)
    setError('');
  };

  // Admin: ปลดแบน/ปลดระงับร้าน/ปิด-เปิดเรื่อง
  const adminAction = async (kind) => {
    const o = conv.owner;
    const asks = {
      unban: `ปลดแบนบัญชีของ ${o.name}?`,
      unbanStore: `ปลดระงับร้านค้าของ ${o.name}?`,
    };
    if (asks[kind] && !window.confirm(asks[kind])) return;
    setBusy(true);
    setError('');
    try {
      if (kind === 'unban') await API.put(`/admin/users/${o.id}/unban`);
      else if (kind === 'unbanStore') await API.put(`/admin/stores/${o.id}/unban`);
      else await API.put(`/chat/conversations/${id}/status`, { status: kind === 'close' ? 'CLOSED' : 'OPEN' });
      await poll();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (error && !conv) {
    return (
      <div className="p-4">
        <Notice type="error">{error}</Notice>
      </div>
    );
  }
  if (!conv) return <Loading text="กำลังเปิดห้องสนทนา..." />;

  const support = conv.type === 'SUPPORT';
  const isAdminSide = conv.side === 'admin';
  const o = conv.owner; // เฉพาะ Admin
  const acc = conv.account; // เฉพาะผู้ใช้ที่ติดต่อ Admin (สถานะบัญชีของตัวเอง)

  return (
    <div className={`flex flex-col min-h-0 ${embedded ? 'h-[72vh] rounded-2xl overflow-hidden border border-slate-200 bg-[#e0f7f7]' : 'h-full'}`}>
      <div className="shrink-0 space-y-1.5 px-3 pt-2 empty:hidden">
        {conv.context && (
          <div className="flex items-center gap-2 bg-white rounded-xl p-2 border border-slate-100">
            {conv.context.kind === 'product' && <ProductImage src={conv.context.imageUrl} alt="" className="w-10 h-10 rounded-lg shrink-0" iconSize={16} />}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-slate-400">{conv.context.kind === 'product' ? 'กำลังสอบถามสินค้า' : 'เกี่ยวกับคำสั่งซื้อ'}</p>
              <p className="text-xs font-bold text-slate-800 truncate">{conv.context.label}</p>
            </div>
            {conv.context.href && (
              <Link href={conv.context.href} className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-cyan-700">
                ดู <ExternalLink size={12} />
              </Link>
            )}
          </div>
        )}

        {/* ผู้ใช้: สถานะบัญชีของตัวเอง (ห้องซัพพอร์ต / ยื่นอุทธรณ์) */}
        {expired && (
          <Box tone="green" icon={CheckCircle2}>
            <p className="font-bold">เซสชันอุทธรณ์สิ้นสุดแล้ว — บัญชีของคุณอาจถูกปลดระงับแล้ว</p>
            <Link href="/login" className="inline-block font-bold underline">เข้าสู่ระบบอีกครั้ง</Link>
          </Box>
        )}
        {support && !isAdminSide && acc?.isBanned && (
          <Box tone="red" icon={Ban}>
            <p className="font-bold">บัญชีของคุณถูกระงับการใช้งาน</p>
            {acc.banReason && <p>เหตุผล: {acc.banReason}</p>}
            <p>พิมพ์ชี้แจง แนบหลักฐานได้ที่นี่ Admin จะพิจารณาและตอบกลับในห้องนี้</p>
          </Box>
        )}
        {support && !isAdminSide && !acc?.isBanned && acc?.storeBanned && (
          <Box tone="amber" icon={Store}>
            <p className="font-bold">ร้านค้าของคุณถูกระงับ</p>
            {acc.storeBanReason && <p>เหตุผล: {acc.storeBanReason}</p>}
            <p>ชี้แจงหรือแนบหลักฐานเพื่อขอเปิดร้านอีกครั้งได้ที่นี่</p>
          </Box>
        )}
        {support && !isAdminSide && conv.topic === 'APPEAL' && acc && !acc.isBanned && !acc.storeBanned && embedded && (
          <Box tone="green" icon={CheckCircle2}>
            <p className="font-bold">บัญชีของคุณถูกปลดระงับแล้ว</p>
            <Link href="/login" className="inline-block font-bold underline">เข้าสู่ระบบอีกครั้ง</Link>
          </Box>
        )}
        {support && !isAdminSide && conv.status === 'CLOSED' && (
          <Box tone="slate" icon={CircleAlert}>
            <p>Admin ปิดเรื่องนี้แล้ว หากยังต้องการความช่วยเหลือ พิมพ์ข้อความใหม่ได้เลย ระบบจะเปิดเรื่องอีกครั้ง</p>
          </Box>
        )}

        {/* Admin: ข้อมูลผู้ใช้ + เครื่องมือ */}
        {isAdminSide && o && (
          <div className="bg-white border border-slate-200 rounded-xl p-2.5 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{o.name} <span className="font-normal text-slate-500">({o.role === 'seller' ? 'ผู้ขาย' : 'ผู้ซื้อ'})</span></p>
                <p className="text-[11px] text-slate-500 truncate">{o.email}</p>
              </div>
              <div className="flex flex-wrap justify-end gap-1 shrink-0">
                {conv.topic === 'APPEAL' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">ยื่นอุทธรณ์</span>}
                {conv.status === 'CLOSED' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">ปิดเรื่องแล้ว</span>}
              </div>
            </div>
            {(o.isBanned || o.storeBanned) && (
              <div className="text-[11px] text-red-600 space-y-0.5">
                {o.isBanned && <p><Ban size={11} className="inline mr-1" />บัญชีถูกแบน{o.banReason ? ` — ${o.banReason}` : ''}</p>}
                {o.storeBanned && <p><Store size={11} className="inline mr-1" />ร้านถูกระงับ{o.storeBanReason ? ` — ${o.storeBanReason}` : ''}</p>}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {o.isBanned && (
                <button type="button" disabled={busy} onClick={() => adminAction('unban')} className="inline-flex items-center gap-1 bg-emerald-500 text-white text-[11px] font-bold px-3 py-1.5 rounded-full disabled:opacity-50">
                  <ShieldCheck size={12} /> ปลดแบนบัญชี
                </button>
              )}
              {o.storeBanned && (
                <button type="button" disabled={busy} onClick={() => adminAction('unbanStore')} className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold px-3 py-1.5 rounded-full disabled:opacity-50">
                  <Store size={12} /> ปลดระงับร้าน
                </button>
              )}
              {conv.status === 'CLOSED' ? (
                <button type="button" disabled={busy} onClick={() => adminAction('open')} className="bg-white border border-slate-300 text-slate-700 text-[11px] font-bold px-3 py-1.5 rounded-full disabled:opacity-50">
                  เปิดเรื่องอีกครั้ง
                </button>
              ) : (
                <button type="button" disabled={busy} onClick={() => adminAction('close')} className="bg-white border border-slate-300 text-slate-700 text-[11px] font-bold px-3 py-1.5 rounded-full disabled:opacity-50">
                  ปิดเรื่อง
                </button>
              )}
            </div>
          </div>
        )}
        {error && <Notice type="error">{error}</Notice>}
      </div>

      <ChatMessages
        messages={messages}
        token={token}
        showSender={support}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadMore={loadMore}
        emptyText={support && !isAdminSide ? 'พิมพ์ข้อความถึงทีมงาน Solify ได้เลย เราจะตอบกลับในห้องนี้' : 'ยังไม่มีข้อความ เริ่มพิมพ์ทักทายได้เลย'}
        className="flex-1 min-h-0 px-3 py-3"
      />

      <Composer
        onSend={send}
        upload={(file) => uploadChatAttachment(file, { scope: 'conversation', scopeId: id, token })}
        disabled={!conv.canSend || expired}
        disabledText={expired ? 'เซสชันอุทธรณ์สิ้นสุดแล้ว กรุณาเข้าสู่ระบบอีกครั้ง' : conv.blockedReason}
        maxLength={LIMITS.CHAT_MESSAGE}
        placeholder={support && !isAdminSide ? 'พิมพ์ข้อความถึง Admin...' : 'พิมพ์ข้อความ...'}
        className="shrink-0"
      />
    </div>
  );
}
