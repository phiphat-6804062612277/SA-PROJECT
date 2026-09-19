import MenuDrawer from '@/components/MenuDrawer';
import ProfileMenu from '@/components/ProfileMenu';

// แถบหัวสีฟ้าพร้อมปุ่มเมนู ☰ และไอคอนโปรไฟล์/แจ้งเตือน — ใช้ในหน้า Home / Shopping
export default function AppHeader({ title }) {
  return (
    <div className="bg-[#9bdadd] h-[60px] px-5 flex items-center gap-3 sticky top-0 z-30">
      <MenuDrawer />
      {title && <span className="font-bold text-slate-800 text-sm truncate">{title}</span>}
      <ProfileMenu showLogin />
    </div>
  );
}
