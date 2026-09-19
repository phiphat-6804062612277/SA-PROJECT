'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Store, Globe } from 'lucide-react';
import API, { errorMessage } from '@/lib/api';
import { LIMITS } from '@/lib/limits';
import ProductImage from '@/components/ProductImage';
import Notice from '@/components/Notice';
import { useToast } from '@/components/Toast';

const inputCls =
  'w-full mt-1 p-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-cyan-500';

const Counter = ({ value, max }) => (
  <span className={`text-[10px] ${value.length >= max ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
    {value.length}/{max}
  </span>
);

// ฟอร์มลง/แก้ไขสินค้า — ถ้ามี product = โหมดแก้ไข
export default function ProductForm({ product }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({
    name: product?.name || '',
    price: product?.price ?? '',
    stock: product?.stock ?? '',
    imageUrl: product?.imageUrl || '',
    description: product?.description || '',
    inStore: product ? product.inStore !== false : true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const priceNum = Number(form.price);
    const stockNum = Number(form.stock);
    if (!Number.isFinite(priceNum) || priceNum <= 0 || priceNum > LIMITS.MAX_PRICE) {
      setError(`ราคาต้องมากกว่า 0 และไม่เกิน ${LIMITS.MAX_PRICE.toLocaleString('en-US')} บาท`);
      return;
    }
    if (!Number.isInteger(stockNum) || stockNum < 0 || stockNum > LIMITS.MAX_STOCK) {
      setError(`จำนวนสต็อกต้องเป็นจำนวนเต็ม 0 - ${LIMITS.MAX_STOCK.toLocaleString('en-US')}`);
      return;
    }
    setSaving(true);
    const payload = { ...form, price: Number(form.price), stock: Number(form.stock) };
    try {
      if (product) await API.put(`/products/${product._id}`, payload);
      else await API.post('/products', payload);
      toast.success(product ? 'บันทึกการแก้ไขแล้ว' : 'ลงขายสินค้าเรียบร้อย');
      router.replace('/seller?tab=products');
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  const placement = [
    { value: true, icon: Store, title: 'ในร้านของฉัน', desc: 'แสดงในหน้าร้านและตลาดรวม' },
    { value: false, icon: Globe, title: 'นอกร้าน', desc: 'ขายในตลาดรวมเท่านั้น' },
  ];

  return (
    <form onSubmit={submit} className="bg-white p-5 rounded-3xl shadow-sm space-y-3 text-xs">
      <ProductImage src={form.imageUrl} alt="ตัวอย่างรูปสินค้า" className="w-full h-40 rounded-2xl" iconSize={40} />

      <div>
        <label htmlFor="pf-image" className="font-bold text-slate-700">ลิงก์รูปสินค้า (URL)</label>
        <input id="pf-image" type="url" value={form.imageUrl} onChange={set('imageUrl')} className={inputCls} placeholder="https://..." />
      </div>

      <div>
        <div className="flex justify-between items-end">
          <label htmlFor="pf-name" className="font-bold text-slate-700">ชื่อสินค้า</label>
          <Counter value={form.name} max={LIMITS.PRODUCT_NAME} />
        </div>
        <input id="pf-name" required maxLength={LIMITS.PRODUCT_NAME} value={form.name} onChange={set('name')} className={inputCls} placeholder="เช่น แผงโซลาร์เซลล์ Mono 550W" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="pf-price" className="font-bold text-slate-700">ราคา (บาท)</label>
          <input id="pf-price" type="number" required min="0.01" max={LIMITS.MAX_PRICE} step="0.01" inputMode="decimal" value={form.price} onChange={set('price')} className={inputCls} />
        </div>
        <div>
          <label htmlFor="pf-stock" className="font-bold text-slate-700">จำนวนในสต็อก</label>
          <input id="pf-stock" type="number" required min="0" max={LIMITS.MAX_STOCK} step="1" inputMode="numeric" value={form.stock} onChange={set('stock')} className={inputCls} />
        </div>
      </div>

      <div>
        <div className="flex justify-between items-end">
          <label htmlFor="pf-desc" className="font-bold text-slate-700">รายละเอียดสินค้า</label>
          <Counter value={form.description} max={LIMITS.PRODUCT_DESC} />
        </div>
        <textarea id="pf-desc" rows={5} maxLength={LIMITS.PRODUCT_DESC} value={form.description} onChange={set('description')} className={inputCls} placeholder="สเปก การรับประกัน ฯลฯ" />
      </div>

      <div>
        <span className="font-bold text-slate-700">วางสินค้าไว้ที่</span>
        <div className="grid grid-cols-2 gap-2 mt-1" role="radiogroup" aria-label="ตำแหน่งวางสินค้า">
          {placement.map(({ value, icon: Icon, title, desc }) => {
            const active = form.inStore === value;
            return (
              <button
                key={title}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setForm({ ...form, inStore: value })}
                className={`p-3 rounded-2xl border-2 text-left transition ${active ? 'border-cyan-500 bg-cyan-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
              >
                <Icon size={18} className={active ? 'text-cyan-600' : 'text-slate-400'} />
                <p className="font-bold text-slate-800 mt-1">{title}</p>
                <p className="text-[10px] text-slate-500">{desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      <Notice type="error">{error}</Notice>

      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving} className="flex-1 bg-[#9bdadd] hover:bg-cyan-300 text-slate-900 font-bold py-3 rounded-full text-sm disabled:opacity-50">
          {saving ? 'กำลังบันทึก...' : product ? 'บันทึกการแก้ไข' : 'ลงขายสินค้า'}
        </button>
        <button type="button" onClick={() => router.back()} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-3 rounded-full text-sm">
          ยกเลิก
        </button>
      </div>
    </form>
  );
}
