import './globals.css';
import BottomNav from '@/components/BottomNav';

export const metadata = {
  title: 'Solify - Solar Cell Marketplace',
  description: 'ซื้อขายอุปกรณ์ Solar Cell ระบบ Escrow',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body className="bg-slate-200 min-h-screen flex justify-center items-center">
        {/* Container จำลองหน้าจอมือถือตาม Wireframe */}
        <div className="w-full max-w-md bg-white min-h-screen relative shadow-2xl flex flex-col font-sans">
          <main className="flex-1 pb-20">{children}</main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}