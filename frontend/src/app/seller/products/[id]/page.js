'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import API from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import PageHeader from '@/components/PageHeader';
import ProductForm from '@/components/ProductForm';
import Loading from '@/components/Loading';

export default function EditProductPage() {
  const { id } = useParams();
  const { user } = useAuth({ roles: ['seller'] });
  const [product, setProduct] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!user) return;
    API.get(`/products/${id}`)
      .then((res) => {
        // แก้ไขได้เฉพาะสินค้าของตัวเอง
        if (String(res.data.sellerId) !== String(user.id)) setNotFound(true);
        else setProduct(res.data);
      })
      .catch(() => setNotFound(true));
  }, [user, id]);

  if (!user) return <Loading />;

  return (
    <div className="bg-[#e0f7f7] min-h-screen">
      <PageHeader title="แก้ไขสินค้า" back />
      <div className="p-4">
        {notFound ? (
          <p className="text-center text-sm text-slate-500 py-10">ไม่พบสินค้า หรือไม่ใช่สินค้าของคุณ</p>
        ) : product ? (
          <ProductForm product={product} />
        ) : (
          <Loading />
        )}
      </div>
    </div>
  );
}
