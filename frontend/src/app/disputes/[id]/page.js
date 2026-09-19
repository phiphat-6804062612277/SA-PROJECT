'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import API, { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import PageHeader from '@/components/PageHeader';
import Loading from '@/components/Loading';
import Notice from '@/components/Notice';
import DisputeView from '@/components/DisputeView';

// รายละเอียดข้อพิพาทสำหรับผู้ซื้อ/ผู้ขาย (Admin ใช้ /admin/disputes/[id])
export default function DisputePage() {
  const { user } = useAuth({ roles: ['buyer', 'seller'] });
  const { id } = useParams();
  const [dispute, setDispute] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setDispute((await API.get(`/disputes/${id}`)).data);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [id]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (!user) return <Loading />;

  return (
    <div className="bg-[#e0f7f7] min-h-screen pb-24">
      <PageHeader title="รายละเอียดข้อพิพาท" back />
      <div className="p-4">
        <Notice type="error">{error}</Notice>
        {!dispute && !error && <Loading />}
        {dispute && <DisputeView dispute={dispute} role={user.role} onChanged={load} />}
      </div>
    </div>
  );
}
