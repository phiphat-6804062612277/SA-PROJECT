// จุดแจ้งเตือนสีแดงเครื่องหมาย ! วางทับมุมขวาบนของไอคอน/รูปโปรไฟล์ (ต้องอยู่ใน element ที่เป็น relative)
export default function NotificationBadge({ count = 0, className = '' }) {
  if (!count) return null;
  return (
    <span
      role="status"
      aria-label={`มีงานที่ต้องดำเนินการ ${count} รายการ`}
      className={`absolute -top-1 -right-1 z-10 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[11px] font-black leading-none flex items-center justify-center ring-2 ring-white pointer-events-none ${className}`}
    >
      !
    </span>
  );
}
