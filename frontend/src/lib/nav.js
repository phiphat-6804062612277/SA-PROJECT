import {
  House,
  ClipboardList,
  MessageCircle,
  Wallet,
  User,
  Store,
  Package,
  Truck,
  LayoutDashboard,
  Scale,
  Users,
  ShoppingBag,
  ShoppingCart,
  LogIn,
  Settings,
  Plus,
  ShieldCheck,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// โครงเมนูตามบทบาท (ใช้ร่วมกันระหว่าง BottomNav และเมนู ☰ ด้านข้าง)
//   { href, label, icon, match(pathname), badge: [คีย์แจ้งเตือน], badgeLabel }
//   badge = คีย์งานค้างจาก /api/notifications (ดู NotificationProvider.countOf) — Badge (!) แสดงที่เมนูนั้นๆ ไม่ใช่ที่ไอคอนโปรไฟล์
// ---------------------------------------------------------------------------
const under = (...bases) => (p) => bases.some((b) => p === b || p.startsWith(`${b}/`));

const CHAT_BADGE = { badge: ['chat_unread'], badgeLabel: 'มีข้อความแชตที่ยังไม่ได้อ่าน' };

export function navFor(user) {
  const role = user?.role;

  if (role === 'buyer') {
    return [
      { href: '/', label: 'หน้าแรก', icon: House, match: (p) => p === '/' || under('/shopping', '/product', '/store', '/cart', '/checkout')(p) },
      { href: '/history', label: 'คำสั่งซื้อ', icon: ClipboardList, match: under('/history', '/disputes'), badge: ['buyer_confirm'], badgeLabel: 'มีออเดอร์รอยืนยันรับสินค้า' },
      { href: '/chat', label: 'ข้อความ', icon: MessageCircle, match: under('/chat'), ...CHAT_BADGE },
      { href: '/wallet', label: 'Wallet', icon: Wallet, match: under('/wallet') },
      { href: '/profile', label: 'โปรไฟล์', icon: User, match: under('/profile') },
    ];
  }

  if (role === 'seller') {
    return [
      { href: `/store/${user.id}`, label: 'หน้าร้าน', icon: Store, match: (p) => p === `/store/${user.id}` },
      {
        href: '/seller/orders',
        label: 'ออเดอร์',
        icon: Truck,
        match: under('/seller/orders', '/disputes'),
        badge: ['seller_ship', 'seller_dispute'],
        badgeLabel: 'มีออเดอร์ใหม่รอจัดส่ง / ข้อพิพาทที่ต้องชี้แจง',
      },
      { href: '/seller/products', label: 'สินค้า', icon: Package, match: under('/seller/products') },
      { href: '/chat', label: 'ข้อความ', icon: MessageCircle, match: under('/chat'), ...CHAT_BADGE },
      { href: '/seller', label: 'แดชบอร์ด', icon: LayoutDashboard, match: (p) => p === '/seller' || under('/seller/store', '/wallet', '/profile')(p) },
    ];
  }

  if (role === 'admin') {
    return [
      { href: '/admin', label: 'ภาพรวม', icon: LayoutDashboard, match: (p) => p === '/admin' },
      { href: '/admin/disputes', label: 'ข้อพิพาท', icon: Scale, match: under('/admin/disputes'), badge: ['admin_disputes'], badgeLabel: 'มีข้อพิพาทรอตัดสิน' },
      { href: '/admin/users', label: 'ผู้ใช้/ร้าน', icon: Users, match: under('/admin/users') },
      { href: '/chat', label: 'Support', icon: MessageCircle, match: under('/chat'), ...CHAT_BADGE },
      { href: '/profile', label: 'โปรไฟล์', icon: User, match: under('/profile') },
    ];
  }

  // ยังไม่ล็อกอิน
  return [
    { href: '/', label: 'หน้าแรก', icon: House, match: (p) => p === '/' },
    { href: '/shopping', label: 'สินค้า', icon: ShoppingBag, match: under('/shopping', '/product', '/store') },
    { href: '/cart', label: 'ตะกร้า', icon: ShoppingCart, match: under('/cart', '/checkout') },
    { href: '/login', label: 'เข้าสู่ระบบ', icon: LogIn, match: under('/login', '/register', '/welcome', '/forgot-password') },
  ];
}

// เมนูเสริมใน ☰ (นอกเหนือจากเมนูหลักด้านบน) แยกตามบทบาท
export function extraMenuFor(user) {
  const role = user?.role;
  if (role === 'buyer') {
    return [
      { href: '/shopping', label: 'สินค้าทั้งหมด', icon: ShoppingBag },
      { href: '/cart', label: 'ตะกร้าสินค้า', icon: ShoppingCart },
      { href: '/chat/new?support=1', label: 'ติดต่อ Admin', icon: ShieldCheck },
    ];
  }
  if (role === 'seller') {
    return [
      { href: '/seller/products/new', label: 'ลงขายสินค้าใหม่', icon: Plus },
      { href: '/seller/store', label: 'ตั้งค่าร้านค้า (โลโก้/แบนเนอร์)', icon: Settings },
      { href: '/wallet', label: 'Wallet / ถอนเงิน', icon: Wallet },
      { href: '/profile', label: 'โปรไฟล์', icon: User },
      { href: '/chat/new?support=1', label: 'ติดต่อ Admin', icon: ShieldCheck },
    ];
  }
  if (role === 'admin') {
    return [{ href: '/', label: 'ดูหน้าตลาด (หน้าแรก)', icon: House }];
  }
  return [];
}
