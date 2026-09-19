'use client';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { safeNext } from '@/lib/auth';
import { useAuth } from '@/lib/useAuth';
import AmountForm from '@/components/AmountForm';
import Loading from '@/components/Loading';

function TopUp() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();
  if (!user) return <Loading />;

  return (
    <AmountForm
      title="เติมเงินเข้า Wallet"
      endpoint="/wallet/topup"
      submitLabel="ยืนยันการเติมเงิน"
      successText="เติมเงินสำเร็จ"
      quickAmounts={[500, 1000, 5000, 10000]}
      // มาจากหน้าชำระเงิน (?next=/checkout...) → เติมเสร็จพากลับไปทันที
      onDone={() => router.push(safeNext(params.get('next'), '/wallet'))}
    />
  );
}

export default function TopUpPage() {
  return (
    <Suspense fallback={<Loading />}>
      <TopUp />
    </Suspense>
  );
}
