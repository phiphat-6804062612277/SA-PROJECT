'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Ban, MessageCircle, ArrowLeft, LogIn } from 'lucide-react';
import API, { errorMessage } from '@/lib/api';
import { authOpts } from '@/lib/chat';
import { clearAppealSession, getAppealSession } from '@/lib/auth';
import ChatRoom from '@/components/chat/ChatRoom';
import Loading from '@/components/Loading';
import Notice from '@/components/Notice';

// หน้า "บัญชีถูกระงับ": ฟังก์ชันอื่นถูกบล็อกทั้งหมด แต่ยังกดติดต่อ Admin / ยื่นเรื่องอุทธรณ์ผ่านแชตซัพพอร์ตได้
// ใช้โทเคนอุทธรณ์ (จากหน้า Login) หรือโทเคนเดิม (ถูกแบนระหว่างใช้งาน) เก็บใน sessionStorage — ใช้ได้กับ /api/chat เท่านั้น
export default function SuspendedPage() {
  const router = useRouter();
  const [session, setSession] = useState(undefined); // undefined = ยังไม่อ่าน, null = ไม่มี
  const [roomId, setRoomId] = useState('');
  const [unread, setUnread] = useState(0);
  const [hasHistory, setHasHistory] = useState(false);
  const [expired, setExpired] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const s = getAppealSession();
    if (!s) {
      router.replace('/login');
      return;
    }
    setSession(s);
  }, [router]);

  const token = session?.token || '';

  // ตรวจว่าเคยคุยกับ Admin ไว้แล้วหรือไม่ + มีข้อความใหม่จาก Admin กี่ข้อความ
  const check = useCallback(async () => {
    if (!token) return;
    try {
      const res = await API.get('/chat/conversations', authOpts(token));
      const support = res.data.conversations.find((c) => c.type === 'SUPPORT');
      setHasHistory(!!support);
      setUnread(support?.unread || 0);
      setExpired(false);
    } catch (err) {
      if (err.response?.status === 401) setExpired(true);
    }
  }, [token]);

  useEffect(() => {
    if (!roomId) check();
  }, [check, roomId]);

  const openChat = async () => {
    setOpening(true);
    setError('');
    try {
      const res = await API.post('/chat/support', {}, authOpts(token));
      setRoomId(res.data.id);
    } catch (err) {
      if (err.response?.status === 401) setExpired(true);
      else setError(errorMessage(err, 'ไม่สามารถเปิดห้องสนทนากับ Admin ได้'));
    } finally {
      setOpening(false);
    }
  };

  const toLogin = () => {
    clearAppealSession();
    router.replace('/login');
  };

  if (session === undefined) return <Loading />;
  if (session === null) return null;

  return (
    <div className="min-h-screen bg-[#e0f7f7]">
      <div className="h-9 bg-[#9bdadd]" />
      <div className="px-5 pt-6 pb-10 space-y-4">
        <div className="bg-white rounded-2xl shadow-sm p-5 text-center space-y-2">
          <span className="mx-auto w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
            <Ban size={28} />
          </span>
          <h1 className="text-lg font-black text-slate-900">บัญชีของคุณถูกระงับการใช้งาน</h1>
          <p className="text-xs text-slate-600 text-wrap-safe">{session.message || 'ไม่สามารถใช้งานฟังก์ชันอื่นของ Solify ได้ในขณะนี้'}</p>
          {session.reason && (
            <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2 text-wrap-safe">เหตุผล: {session.reason}</p>
          )}
          <p className="text-[11px] text-slate-500">
            หากคิดว่าเกิดความผิดพลาดหรือต้องการชี้แจง คุณยังติดต่อ Admin เพื่อยื่นเรื่องอุทธรณ์ พร้อมแนบรูปภาพหรือเอกสารหลักฐานได้
          </p>
        </div>

        {!token && (
          <Notice type="error">เซสชันไม่สมบูรณ์ กรุณาเข้าสู่ระบบอีกครั้งเพื่อยื่นเรื่องอุทธรณ์</Notice>
        )}
        {expired && (
          <Notice type="error">เซสชันหมดอายุ หรือบัญชีของคุณถูกปลดระงับแล้ว กรุณาเข้าสู่ระบบอีกครั้ง</Notice>
        )}
        <Notice type="error">{error}</Notice>

        {token && !expired && !roomId && (
          <button
            type="button"
            onClick={openChat}
            disabled={opening}
            className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold py-3 rounded-full disabled:opacity-50"
          >
            <MessageCircle size={18} />
            {opening ? 'กำลังเปิดห้องสนทนา...' : 'ติดต่อ Admin / ยื่นเรื่องอุทธรณ์'}
            {unread > 0 && <span className="min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{unread}</span>}
          </button>
        )}
        {token && !expired && !roomId && hasHistory && (
          <p className="text-[11px] text-center text-slate-500">
            {unread > 0 ? `มี ${unread} ข้อความใหม่จาก Admin` : 'คุณเคยติดต่อ Admin ไว้แล้ว กดปุ่มเพื่อเปิดห้องสนทนาเดิม'}
          </p>
        )}

        {roomId && (
          <section aria-label="แชตกับ Admin" className="space-y-2">
            <ChatRoom id={roomId} token={token} embedded />
            <button
              type="button"
              onClick={() => {
                setRoomId('');
                check();
              }}
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-600"
            >
              <ArrowLeft size={14} /> ปิดห้องสนทนา
            </button>
          </section>
        )}

        <button type="button" onClick={toLogin} className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-bold text-cyan-800 underline pt-2">
          <LogIn size={14} /> กลับไปหน้าเข้าสู่ระบบ
        </button>
        <p className="text-[10px] text-center text-slate-400">
          <Link href="/welcome" className="hover:underline">หน้าแรก</Link>
        </p>
      </div>
    </div>
  );
}
