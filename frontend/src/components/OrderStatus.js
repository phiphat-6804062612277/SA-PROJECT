// ป้ายสถานะคำสั่งซื้อ + คำอธิบายสถานะเงิน Escrow
export const STATUS = {
  PENDING_SHIPMENT: { label: 'รอผู้ขายจัดส่ง', cls: 'bg-amber-100 text-amber-700' },
  SHIPPED: { label: 'จัดส่งแล้ว', cls: 'bg-sky-100 text-sky-700' },
  COMPLETED: { label: 'สำเร็จ', cls: 'bg-emerald-100 text-emerald-700' },
  DISPUTED: { label: 'อยู่ระหว่างข้อพิพาท', cls: 'bg-red-100 text-red-600' },
  REFUNDED: { label: 'คืนเงินแล้ว', cls: 'bg-violet-100 text-violet-700' },
  CANCELLED: { label: 'ยกเลิกแล้ว', cls: 'bg-slate-200 text-slate-600' },
};

export const ESCROW_TEXT = {
  HELD: 'เงินถูกถือไว้ในระบบ Escrow',
  RELEASED: 'โอนเงินให้ผู้ขายแล้ว',
  REFUNDED: 'คืนเงินเข้า Wallet ผู้ซื้อแล้ว',
};

// ข้อความสถานะเงินของออเดอร์ (ออเดอร์ที่ถูกเปิดข้อพิพาท เงินยังอยู่ใน Escrow แต่ถูก Freeze)
export const escrowText = (o) =>
  o.status === 'DISPUTED' ? 'เงินถูก Freeze ไว้ใน Escrow รอ Admin ตัดสินข้อพิพาท' : ESCROW_TEXT[o.escrowStatus];

export default function OrderStatus({ status }) {
  const s = STATUS[status] || { label: status, cls: 'bg-slate-100 text-slate-600' };
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>;
}
