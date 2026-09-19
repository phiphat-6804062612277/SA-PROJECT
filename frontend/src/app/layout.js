import './globals.css';
import BottomNav from '@/components/BottomNav';
import { ToastProvider } from '@/components/Toast';
import NotificationProvider from '@/components/NotificationProvider';

export const metadata = {
  title: 'Solify - Solar Cell Marketplace',
  description: 'ซื้อขายอุปกรณ์ Solar Cell ระบบ Escrow',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body className="bg-slate-200 min-h-screen flex justify-center items-center">
        {/* Container จำลองหน้าจอมือถือตาม Wireframe */}
        <div className="w-full max-w-md bg-white min-h-screen relative shadow-2xl flex flex-col font-sans overflow-x-hidden">
          <ToastProvider>
            <NotificationProvider>
              <main className="flex-1 pb-20">{children}</main>
              <BottomNav />
            </NotificationProvider>
          </ToastProvider>
        </div>
      </body>
    </html>
  );
}
