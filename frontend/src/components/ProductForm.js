'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import API, { errorMessage } from '@/lib/api';
import ProductImage from '@/components/ProductImage';
import Notice from '@/components/Notice';

const inputCls =
  'w-full mt-1 p-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-cyan-500';

// ฟอร์มลง/แก้ไขสินค้า — ถ้ามี product = โหมดแก้ไข
export default function ProductForm({ product }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: product?.name || '',
    price: product?.price ?? '',
    stock: product?.stock ?? '',
    imageUrl: product?.imageUrl || '',
    description: product?.description || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    const payload = { ...form, price: Number(form.price), stock: Number(form.stock) };
    try {
      if (product) await API.put(`/products/${product._id}`, payload);
      else await API.post('/products', payload);
      router.replace('/seller?tab=products');
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-white p-5 rounded-3xl shadow-sm space-y-3 text-xs">
      <ProductImage src={form.imageUrl} alt="ตัวอย่างรูปสินค้า" className="w-full h-40 rounded-2xl" iconSize={40} />

      <div>
        <label htmlFor="pf-image" className="font-bold text-slate-700">ลิงก์รูปสินค้า (URL)</label>
        <input id="pf-image" type="url" value={form.imageUrl} onChange={set('imageUrl')} className={inputCls} placeholder="https://..." />
      </div>
      <div>
        <label htmlFor="pf-name" className="font-bold text-slate-700">ชื่อสินค้า</label>
        <input id="pf-name" required value={form.name} onChange={set('name')} className={inputCls} placeholder="เช่น แผงโซลาร์เซลล์ Mono 550W" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="pf-price" className="font-bold text-slate-700">ราคา (บาท)</label>
          <input id="pf-price" type="number" required min="1" step="any" inputMode="decimal" value={form.price} onChange={set('price')} className={inputCls} />
        </div>
        <div>
          <label htmlFor="pf-stock" className="font-bold text-slate-700">จำนวนในสต็อก</label>
          <input id="pf-stock" type="number" required min="0" step="1" inputMode="numeric" value={form.stock} onChange={set('stock')} className={inputCls} />
        </div>
      </div>
      <div>
        <label htmlFor="pf-desc" className="font-bold text-slate-700">รายละเอียดสินค้า</label>
        <textarea id="pf-desc" rows={4} value={form.description} onChange={set('description')} className={inputCls} placeholder="สเปก การรับประกัน ฯลฯ" />
      </div>

      <Notice type="error">{error}</Notice>

      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving} className="flex-1 bg-[#8be0e0] hover:bg-cyan-300 text-slate-900 font-bold py-3 rounded-full text-sm disabled:opacity-50">
          {saving ? 'กำลังบันทึก...' : product ? 'บันทึกการแก้ไข' : 'ลงขายสินค้า'}
        </button>
        <button type="button" onClick={() => router.back()} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-3 rounded-full text-sm">
          ยกเลิก
        </button>
      </div>
    </form>
  );
}
