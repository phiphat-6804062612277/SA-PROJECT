'use client';
import { useAuth } from '@/lib/useAuth';
import PageHeader from '@/components/PageHeader';
import ProductForm from '@/components/ProductForm';
import Loading from '@/components/Loading';

export default function NewProductPage() {
  const { user } = useAuth({ roles: ['seller'] });
  if (!user) return <Loading />;

  return (
    <div className="bg-[#e0f7f7] min-h-screen">
      <PageHeader title="ลงขายสินค้าใหม่" back />
      <div className="p-4">
        <ProductForm />
      </div>
    </div>
  );
}
