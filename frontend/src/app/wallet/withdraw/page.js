'use client';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import AmountForm from '@/components/AmountForm';
import Loading from '@/components/Loading';

export default function WithdrawPage() {
  const router = useRouter();
  const { user } = useAuth({ roles: ['seller'] });
  if (!user) return <Loading />;

  return (
    <AmountForm
      title="ถอนเงินจาก Wallet"
      endpoint="/wallet/withdraw"
      submitLabel="ยืนยันการถอนเงิน"
      successText="ถอนเงินสำเร็จ (ระบบจำลอง)"
      quickAmounts={[500, 1000, 5000, 10000]}
      onDone={() => setTimeout(() => router.push('/wallet'), 800)}
    />
  );
}
