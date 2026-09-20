'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { MessageCircle, ShieldCheck } from 'lucide-react';
import API, { errorMessage } from '@/lib/api';
import { listTime } from '@/lib/chat';
import { useAuth } from '@/lib/useAuth';
import PageHeader from '@/components/PageHeader';
import Avatar from '@/components/Avatar';
import Loading from '@/components/Loading';
import Notice from '@/components/Notice';

const POLL_MS = 10_000;
const ROLE_LABEL = { buyer: 'ผู้ซื้อ', seller: 'ผู้ขาย', admin: 'Admin' };

const ADMIN_FILTERS = [
  { key: 'all', label: 'ทั้งหมด', query: '' },
  { key: 'unread', label: 'ยังไม่อ่าน', query: '?unread=1', count: 'unread' },
  { key: 'appeal', label: 'ยื่นอุทธรณ์', query: '?topic=APPEAL&status=OPEN', count: 'appeal' },
  { key: 'open', label: 'เปิดอยู่', query: '?status=OPEN', count: 'open' },
  { key: 'closed', label: 'ปิดแล้ว', query: '?status=CLOSED' },
];

const Pill = ({ cls, children }) => <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${cls}`}>{children}</span>;

function Row({ c }) {
  const p = c.counterpart;
  const support = c.type === 'SUPPORT';
  return (
    <li>
      <Link href={`/chat/${c.id}`} className="flex items-center gap-3 bg-white rounded-2xl shadow-sm p-3 hover:bg-slate-50">
        {support && !p.avatarUrl && c.side !== 'admin' ? (
          <span className="w-11 h-11 shrink-0 rounded-full bg-violet-200 text-violet-800 flex items-center justify-center">
            <ShieldCheck size={22} />
          </span>
        ) : (
          <Avatar src={p.avatarUrl} name={p.name} size={44} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className={`text-sm truncate ${c.unread ? 'font-black text-slate-900' : 'font-bold text-slate-800'}`}>{p.name}</p>
            {p.role && p.role !== 'admin' && <Pill cls="bg-slate-100 text-slate-600">{ROLE_LABEL[p.role] || p.role}</Pill>}
            {support && c.side !== 'admin' && <Pill cls="bg-violet-100 text-violet-700">ติดต่อ Admin</Pill>}
            {c.topic === 'APPEAL' && <Pill cls="bg-red-100 text-red-600">ยื่นอุทธรณ์</Pill>}
            {c.status === 'CLOSED' && <Pill cls="bg-slate-200 text-slate-600">ปิดแล้ว</Pill>}
          </div>
          <p className={`text-xs truncate ${c.unread ? 'text-slate-800 font-semibold' : 'text-slate-500'}`}>
            {c.lastMessage ? `${c.lastMessage.fromMe ? 'คุณ: ' : ''}${c.lastMessage.preview}` : 'ยังไม่มีข้อความ'}
          </p>
          {c.context && <p className="text-[10px] text-slate-400 truncate">{c.context.kind === 'product' ? 'สินค้า: ' : ''}{c.context.label}</p>}
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <span className="text-[10px] text-slate-400">{listTime(c.lastMessage?.at || c.lastMessageAt)}</span>
          {c.unread > 0 && (
            <span className="min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{c.unread > 99 ? '99+' : c.unread}</span>
          )}
        </div>
      </Link>
    </li>
  );
}

// กล่องข้อความ: แชตกับร้านค้า/ผู้ซื้อ + ห้องติดต่อ Admin (Admin เห็นห้องซัพพอร์ตของผู้ใช้ทั้งหมด)
export default function ChatInboxPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [filter, setFilter] = useState('all');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    const q = isAdmin ? ADMIN_FILTERS.find((f) => f.key === filter)?.query || '' : '';
    try {
      const res = await API.get(`/chat/conversations${q}`);
      setData(res.data);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [user, isAdmin, filter]);

  useEffect(() => {
    load();
    const tick = () => {
      if (!document.hidden) load();
    };
    const timer = setInterval(tick, POLL_MS);
    window.addEventListener('focus', tick);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', tick);
    };
  }, [load]);

  if (!user) return <Loading />;
  const list = data?.conversations;

  return (
    <div className="bg-[#e0f7f7] min-h-screen pb-24">
      <PageHeader title="ข้อความ" back />
      <div className="p-4 space-y-3">
        {isAdmin ? (
          <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="กรองห้องสนทนา">
            {ADMIN_FILTERS.map((f) => {
              const n = f.count ? data?.counts?.[f.count] : 0;
              return (
                <button
                  key={f.key}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.key}
                  onClick={() => setFilter(f.key)}
                  className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-full ${filter === f.key ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'}`}
                >
                  {f.label}
                  {n > 0 && <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${filter === f.key ? 'bg-white/20' : 'bg-red-500 text-white'}`}>{n}</span>}
                </button>
              );
            })}
          </div>
        ) : (
          <Link href="/chat/new?support=1" className="flex items-center gap-3 bg-violet-50 border border-violet-200 rounded-2xl p-3 hover:bg-violet-100">
            <span className="w-10 h-10 rounded-full bg-violet-200 text-violet-800 flex items-center justify-center shrink-0">
              <ShieldCheck size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-violet-900">ติดต่อ Admin</p>
              <p className="text-[11px] text-violet-700">สอบถามปัญหา ติดตามข้อพิพาท หรือแจ้งปัญหาการใช้งาน</p>
            </div>
          </Link>
        )}

        <Notice type="error">{error}</Notice>
        {!list && !error && <Loading />}
        {list && list.length === 0 && (
          <div className="text-center py-14 text-slate-500 space-y-2">
            <MessageCircle size={40} className="mx-auto text-slate-300" />
            <p className="text-sm font-bold">{isAdmin ? 'ไม่มีห้องสนทนาในหมวดนี้' : 'ยังไม่มีข้อความ'}</p>
            {!isAdmin && <p className="text-xs">กดปุ่ม "แชตกับร้านค้า" ที่หน้าสินค้าหรือหน้าร้านเพื่อเริ่มสนทนา</p>}
          </div>
        )}
        {list && list.length > 0 && <ul className="space-y-2">{list.map((c) => <Row key={c.id} c={c} />)}</ul>}
      </div>
    </div>
  );
}
