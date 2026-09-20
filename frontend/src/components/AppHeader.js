import MenuDrawer from '@/components/MenuDrawer';
import ProfileMenu from '@/components/ProfileMenu';
import CartButton from '@/components/CartButton';

// แถบหัวสีฟ้าพร้อมปุ่มเมนู ☰ ตะกร้า และรูปโปรไฟล์ — ใช้ในหน้า Home / Shopping
export default function AppHeader({ title }) {
  return (
    <div className="bg-[#9bdadd] h-[60px] px-5 flex items-center gap-3 sticky top-0 z-30">
      <MenuDrawer />
      {title && <span className="font-bold text-slate-800 text-sm truncate">{title}</span>}
      <div className="ml-auto flex items-center gap-2.5">
        <CartButton />
        <ProfileMenu showLogin />
      </div>
    </div>
  );
}
