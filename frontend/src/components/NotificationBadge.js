// จุดแจ้งเตือนสีแดงเครื่องหมาย ! วางทับมุมขวาบนของไอคอนเมนู (ต้องอยู่ใน element ที่เป็น relative)
//   label = คำอธิบายสำหรับ Screen reader เช่น "มีออเดอร์รอยืนยันรับสินค้า"
export default function NotificationBadge({ count = 0, label = 'มีงานที่ต้องดำเนินการ', className = '' }) {
  if (!count) return null;
  return (
    <span
      role="status"
      aria-label={`${label} (${count})`}
      className={`absolute -top-1.5 -right-2 z-10 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[11px] font-black leading-none flex items-center justify-center ring-2 ring-white pointer-events-none ${className}`}
    >
      !
    </span>
  );
}
