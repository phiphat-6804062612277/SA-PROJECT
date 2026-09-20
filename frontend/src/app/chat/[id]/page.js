'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';
import Avatar from '@/components/Avatar';
import Loading from '@/components/Loading';
import ChatRoom from '@/components/chat/ChatRoom';

const ROLE_LABEL = { buyer: 'ผู้ซื้อ', seller: 'ผู้ขาย', admin: 'Admin' };

// ห้องสนทนา 1 ห้อง — เต็มหน้าจอเหนือ BottomNav (ช่องพิมพ์อยู่ล่างสุดเสมอ)
export default function ChatRoomPage() {
  const { user } = useAuth();
  const { id } = useParams();
  const router = useRouter();
  const [meta, setMeta] = useState(null);

  if (!user) return <Loading />;

  const p = meta?.counterpart;
  const supportUser = meta?.type === 'SUPPORT' && meta.side !== 'admin';
  const subtitle = !meta ? '' : supportUser ? 'ติดต่อ Admin' : meta.type === 'SUPPORT' ? `ห้องซัพพอร์ต · ${ROLE_LABEL[p.role] || ''}` : ROLE_LABEL[p?.role] || '';

  return (
    <div className="fixed left-1/2 -translate-x-1/2 w-full max-w-md top-0 bottom-[68px] z-40 flex flex-col bg-[#e0f7f7]">
      <header className="shrink-0 bg-[#9bdadd] px-3 py-2.5 flex items-center gap-3">
        <button type="button" onClick={() => router.back()} aria-label="ย้อนกลับ" className="text-slate-700 p-1">
          <ArrowLeft size={22} />
        </button>
        {p && (supportUser ? (
          <span className="w-9 h-9 shrink-0 rounded-full bg-violet-200 text-violet-800 flex items-center justify-center"><ShieldCheck size={18} /></span>
        ) : (
          <Avatar src={p.avatarUrl} name={p.name} size={36} ring />
        ))}
        <div className="min-w-0 flex-1">
          <h1 className="font-bold text-slate-800 text-sm truncate">{p ? p.name : 'ห้องสนทนา'}</h1>
          {subtitle && <p className="text-[11px] text-slate-600 truncate">{subtitle}</p>}
        </div>
      </header>
      <div className="flex-1 min-h-0">
        <ChatRoom key={id} id={id} onMeta={setMeta} />
      </div>
    </div>
  );
}
