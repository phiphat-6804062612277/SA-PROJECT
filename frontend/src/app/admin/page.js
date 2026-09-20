'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Scale, ChevronRight, MessageCircle, Users, Store, Ban, ShieldCheck } from 'lucide-react';
import API, { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import PageHeader from '@/components/PageHeader';
import Loading from '@/components/Loading';
import Notice from '@/components/Notice';
import { useNotifications } from '@/components/NotificationProvider';

const Stat = ({ label, value, tone }) => (
  <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
    <p className={`text-xl font-black ${tone || 'text-slate-900'}`}>{value}</p>
    <p className="text-[10px] text-slate-500">{label}</p>
  </div>
);

const ActionCard = ({ href, icon: Icon, iconCls, title, hint, count, alert }) => (
  <Link href={href} className={`flex items-center gap-3 rounded-2xl p-3 shadow-sm ${alert ? 'bg-amber-50 ring-2 ring-amber-300' : 'bg-white'}`}>
    <span className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${iconCls}`}>
      <Icon size={20} />
    </span>
    <span className="flex-1 min-w-0">
      <span className="block text-sm font-bold text-slate-900">{title}</span>
      <span className="block text-[11px] text-slate-500">{hint}</span>
    </span>
    {count > 0 && <span className="bg-red-500 text-white text-xs font-black rounded-full min-w-6 h-6 px-2 flex items-center justify-center">{count}</span>}
    <ChevronRight size={18} className="text-slate-300 shrink-0" />
  </Link>
);

// ภาพรวมระบบ (เมนู "ภาพรวม"): สถิติ + ทางลัดไปงานที่ค้างอยู่ — การจัดการผู้ใช้/ร้านค้าอยู่ที่เมนู "ผู้ใช้/ร้าน"
export default function AdminOverviewPage() {
  const { user } = useAuth({ roles: ['admin'] });
  const { countOf } = useNotifications();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    API.get('/admin/stats')
      .then((res) => setStats(res.data))
      .catch((err) => setError(errorMessage(err)));
  }, [user]);

  if (!user) return <Loading />;

  const chatUnread = countOf('chat_unread');
  const pending = stats?.pendingDisputes || 0;

  return (
    <div className="bg-[#dcf0f1] min-h-screen pb-6">
      <PageHeader title="ภาพรวมระบบ (Admin)" right={<ShieldCheck size={20} className="text-slate-700" />} />

      <div className="p-4 space-y-4">
        <Notice type="error">{error}</Notice>

        <ActionCard
          href="/admin/disputes"
          icon={Scale}
          iconCls="bg-violet-100 text-violet-600"
          title="จัดการข้อพิพาท (Disputes)"
          hint={stats ? (pending ? `รอพิจารณา ${pending} รายการ — เงินถูก Freeze ไว้ใน Escrow` : 'ไม่มีข้อพิพาทที่รอพิจารณา') : 'ไกล่เกลี่ยข้อพิพาทระหว่างผู้ซื้อและผู้ขาย'}
          count={pending}
          alert={pending > 0}
        />
        <ActionCard
          href="/chat"
          icon={MessageCircle}
          iconCls="bg-cyan-100 text-cyan-700"
          title="Support Chat / คำขออุทธรณ์"
          hint={chatUnread ? `มี ${chatUnread} ห้องสนทนาที่ยังไม่ได้อ่าน` : 'ตอบผู้ใช้ที่ติดต่อ Admin และพิจารณาคำขอปลดระงับ'}
          count={chatUnread}
          alert={chatUnread > 0}
        />
        <ActionCard
          href="/admin/users"
          icon={Users}
          iconCls="bg-emerald-100 text-emerald-700"
          title="ผู้ใช้ & ร้านค้า"
          hint="ค้นหา แบน/ปลดแบนบัญชีและร้านค้า ลบสินค้าที่ไม่เหมาะสม"
        />

        {stats && (
          <>
            <div className="grid grid-cols-4 gap-2">
              <Stat label="ผู้ใช้" value={stats.users} />
              <Stat label="ผู้ขาย" value={stats.sellers} />
              <Stat label="สินค้า" value={stats.products} />
              <Stat label="ออเดอร์" value={stats.orders} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/admin/users" className="block">
                <div className="bg-white rounded-2xl p-3 shadow-sm flex items-center gap-2">
                  <Ban size={18} className={stats.bannedUsers ? 'text-red-500' : 'text-slate-300'} />
                  <div>
                    <p className={`text-xl font-black ${stats.bannedUsers ? 'text-red-500' : 'text-slate-900'}`}>{stats.bannedUsers}</p>
                    <p className="text-[10px] text-slate-500">บัญชีที่ถูกระงับ</p>
                  </div>
                </div>
              </Link>
              <Link href="/admin/users" className="block">
                <div className="bg-white rounded-2xl p-3 shadow-sm flex items-center gap-2">
                  <Store size={18} className={stats.bannedStores ? 'text-red-500' : 'text-slate-300'} />
                  <div>
                    <p className={`text-xl font-black ${stats.bannedStores ? 'text-red-500' : 'text-slate-900'}`}>{stats.bannedStores}</p>
                    <p className="text-[10px] text-slate-500">ร้านที่ถูกระงับ</p>
                  </div>
                </div>
              </Link>
            </div>
          </>
        )}
        {!stats && !error && <Loading />}
      </div>
    </div>
  );
}
