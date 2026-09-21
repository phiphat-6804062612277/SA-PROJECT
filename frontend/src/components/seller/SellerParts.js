'use client';
import { LOW_STOCK } from '@/components/seller/SellerProductRow';

// ส่วนที่ใช้ร่วมกันในหน้าออเดอร์ / สินค้า / แดชบอร์ดของผู้ขาย

export const ORDER_FILTERS = [
  { key: 'todo', label: 'ต้องจัดส่ง', test: (o) => o.status === 'PENDING_SHIPMENT' },
  { key: 'shipped', label: 'จัดส่งแล้ว', test: (o) => o.status === 'SHIPPED' },
  { key: 'disputed', label: 'ข้อพิพาท', test: (o) => o.status === 'DISPUTED' },
  { key: 'done', label: 'สำเร็จ', test: (o) => o.status === 'COMPLETED' },
  { key: 'cancelled', label: 'ยกเลิก/คืนเงิน', test: (o) => o.status === 'CANCELLED' || o.status === 'REFUNDED' },
  { key: 'all', label: 'ทั้งหมด', test: () => true },
];

export const PRODUCT_FILTERS = [
  { key: 'all', label: 'ทั้งหมด', test: () => true },
  { key: 'low', label: 'สต็อกต่ำ', test: (p) => p.stock <= LOW_STOCK },
];

export const countBy = (list, key, filters) => list.filter(filters.find((f) => f.key === key).test).length;

export const Chip = ({ active, onClick, children, count }) => (
  <button
    onClick={onClick}
    aria-pressed={active}
    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition ${
      active ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
    }`}
  >
    {children}
    {count !== undefined && <span className={`ml-1 ${active ? 'text-cyan-200' : 'text-slate-400'}`}>{count}</span>}
  </button>
);
