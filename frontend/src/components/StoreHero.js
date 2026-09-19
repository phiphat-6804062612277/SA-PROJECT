import Avatar from '@/components/Avatar';
import { imageSrc } from '@/lib/image';

/**
 * ส่วนหัวของหน้าร้าน: แบนเนอร์ปก + โลโก้ร้านซ้อนทับ + ชื่อร้าน (ไม่มีแบนเนอร์ใช้พื้นไล่สีธีมแทน)
 * children = ข้อมูลใต้ชื่อร้าน เช่น คะแนน / สถิติ / คำอธิบาย
 */
export default function StoreHero({ name, logoUrl, bannerUrl, subtitle, children }) {
  return (
    <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
      <div className="relative h-32 bg-gradient-to-br from-[#9bdadd] via-cyan-200 to-sky-300">
        {bannerUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageSrc(bannerUrl)} alt={`แบนเนอร์ร้าน ${name}`} className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/25 to-transparent" aria-hidden="true" />
      </div>
      <div className="px-4 pb-4">
        <div className="-mt-9 flex items-end gap-3">
          {/* relative z-10: แบนเนอร์เป็น relative จึงวาดทับองค์ประกอบที่ตามมาถ้าไม่ตั้ง z-index ให้โลโก้ */}
          <Avatar src={logoUrl} name={name} size={72} className="relative z-10 ring-4 ring-white shadow" />
          <div className="min-w-0 pt-2">
              <h2 className="font-bold text-slate-900 text-base leading-tight text-wrap-safe">{name}</h2>
              {subtitle && <p className="text-[11px] text-slate-500 truncate">{subtitle}</p>}
          </div>
        </div>
        {children && <div className="mt-3 space-y-2">{children}</div>}
      </div>
    </div>
  );
}
