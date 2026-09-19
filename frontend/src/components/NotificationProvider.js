'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import API from '@/lib/api';
import { clearSession, getStoredUser, hasToken, USER_EVENT } from '@/lib/auth';

const EMPTY = { total: 0, items: [], loaded: false, error: false };
const NotificationContext = createContext({ ...EMPTY, refresh: () => {} });

// งานที่ต้องทำของผู้ใช้ตามบทบาท (Buyer: รอยืนยันรับสินค้า / Seller: รอจัดส่ง / Admin: ข้อพิพาทรอตัดสิน)
//   const { total, items, refresh } = useNotifications();
export const useNotifications = () => useContext(NotificationContext);

const POLL_MS = 45_000;
// การกระทำที่เปลี่ยนงานค้าง (ยืนยันรับสินค้า / จัดส่ง / เปิด-ตัดสินข้อพิพาท / ยกเลิกออเดอร์) → รีเฟรช Badge ทันทีหลังสำเร็จ
const TASK_ACTION_RE = /^\/(orders|disputes|admin)(\/|$)/;

// ดึง /api/notifications ตอนเปิดหน้า, ทุกครั้งที่เปลี่ยนหน้า, ทุก 45 วินาที และเมื่อกลับมาที่แท็บนี้
export default function NotificationProvider({ children }) {
  const pathname = usePathname();
  const [state, setState] = useState(EMPTY);
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    const my = ++seq.current;
    if (!hasToken() || !getStoredUser()) {
      setState((prev) => (prev.loaded || prev.total ? EMPTY : prev));
      return;
    }
    try {
      // skipAuthRedirect: ถ้า token หมดอายุ ไม่ต้องเด้งไปหน้า Login ระหว่างที่ผู้ใช้กำลังดูหน้าสาธารณะ/หน้า Auth
      const res = await API.get('/notifications', { skipAuthRedirect: true });
      if (my === seq.current) setState({ total: res.data.total || 0, items: res.data.items || [], loaded: true, error: false });
    } catch (err) {
      if (my !== seq.current) return;
      if (err?.response?.status === 401) {
        // เซสชันหมดอายุ → ล้างเงียบๆ ให้ Header กลับเป็นสถานะยังไม่ล็อกอิน (หน้าที่ต้องล็อกอินจะพาไป Login เอง)
        clearSession();
        window.dispatchEvent(new Event(USER_EVENT));
        setState(EMPTY);
      } else {
        // เครือข่ายสะดุด — คงค่าเดิมไว้ (ถ้ายังไม่เคยโหลดสำเร็จ ให้ Dropdown แจ้งว่าโหลดไม่ได้)
        setState((prev) => ({ ...prev, error: true }));
      }
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [pathname, refresh]);

  // หลังทำรายการที่เปลี่ยนงานค้างสำเร็จ (POST/PUT/DELETE บน orders/disputes/admin) → โหลดใหม่ (หน่วงสั้นๆ รวมหลายคำขอติดกัน)
  useEffect(() => {
    let timer = null;
    const id = API.interceptors.response.use((res) => {
      const method = String(res.config?.method || 'get').toLowerCase();
      if (method !== 'get' && TASK_ACTION_RE.test(res.config?.url || '')) {
        clearTimeout(timer);
        timer = setTimeout(refresh, 300);
      }
      return res;
    });
    return () => {
      clearTimeout(timer);
      API.interceptors.response.eject(id);
    };
  }, [refresh]);

  useEffect(() => {
    const tick = () => {
      if (!document.hidden) refresh();
    };
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    window.addEventListener(USER_EVENT, refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
      window.removeEventListener(USER_EVENT, refresh);
    };
  }, [refresh]);

  const value = useMemo(() => ({ ...state, refresh }), [state, refresh]);
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}
