'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import API, { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import PageHeader from '@/components/PageHeader';
import Loading from '@/components/Loading';
import Notice from '@/components/Notice';

// จุดเริ่มต้นแชต: เปิด/หาห้องแล้วพาไปห้องนั้น
//   ?sellerId=&productId=  ผู้ซื้อทักร้าน (productId ไม่บังคับ)     ?orderId=  ผู้ซื้อ/ผู้ขายคุยเรื่องออเดอร์
//   ?support=1            ติดต่อ Admin                            ?userId=   (Admin) เริ่มคุยกับผู้ใช้
function Starter() {
  const { user } = useAuth();
  const params = useSearchParams();
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || started.current) return;
    started.current = true;
    (async () => {
      try {
        let res;
        if (params.get('support') === '1' || params.get('userId')) {
          res = await API.post('/chat/support', params.get('userId') ? { userId: params.get('userId') } : {});
        } else {
          const body = {};
          for (const k of ['sellerId', 'productId', 'orderId']) if (params.get(k)) body[k] = params.get(k);
          res = await API.post('/chat/conversations', body);
        }
        router.replace(`/chat/${res.data.id}`);
      } catch (err) {
        setError(errorMessage(err, 'ไม่สามารถเริ่มการสนทนาได้'));
      }
    })();
  }, [user, params, router]);

  return (
    <div className="bg-[#e0f7f7] min-h-screen pb-24">
      <PageHeader title="ข้อความ" back />
      <div className="p-4 space-y-3">
        <Notice type="error">{error}</Notice>
        {error ? (
          <Link href="/chat" className="block text-center text-xs font-bold text-cyan-700 underline">ไปที่กล่องข้อความ</Link>
        ) : (
          <Loading text="กำลังเปิดห้องสนทนา..." />
        )}
      </div>
    </div>
  );
}

export default function NewChatPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Starter />
    </Suspense>
  );
}
