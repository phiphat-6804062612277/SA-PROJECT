import axios from 'axios';
import { USER_EVENT, clearSession, getAppealSession, setAppealSession, setAuthNotice } from '@/lib/auth';

const API = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
});

// แนบ JWT Token เข้า Header อัตโนมัติถ้ามีการ Login แล้ว
API.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    // authToken = โทเคนที่ระบุเอง (เช่น appeal token ของผู้ใช้ที่ถูกแบนในหน้า /suspended) ใช้แทนโทเคนใน localStorage
    const token = config.authToken || localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const isAuthCall = (url = '') =>
  ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/verify-otp', '/auth/reset-password'].some((p) =>
    url.startsWith(p)
  );

// Token หมดอายุ → ล้างเซสชันแล้วพาไปหน้า Login / บัญชีถูกแบน → ล้างเซสชันแล้วพาไปหน้า "บัญชีถูกระงับ" (/suspended)
// ซึ่งมีปุ่ม "ติดต่อ Admin / ยื่นเรื่องอุทธรณ์" — เก็บโทเคนเดิมไว้ใช้กับแชตซัพพอร์ตเท่านั้น (API อื่นถูกบล็อกอยู่)
API.interceptors.response.use(
  (res) => res,
  (err) => {
    // skipAuthRedirect = คำขอเบื้องหลัง (เช่น แจ้งเตือน) ที่ไม่ควรเด้งผู้ใช้ไปหน้า Login เอง
    // authToken = คำขอที่ใช้โทเคนเฉพาะกิจ (หน้า /suspended) จัดการข้อผิดพลาดเองในหน้านั้น
    // Single Active Session: มีการล็อกอินบัญชีนี้จากเครื่อง/เบราว์เซอร์อื่นแล้ว → เครื่องนี้ถูกออกจากระบบทันที
    // (ทำกับทุกคำขอ รวมถึงคำขอเบื้องหลังอย่างแจ้งเตือน/แชตที่ตั้ง skipAuthRedirect ไว้ — ไม่งั้นผู้ใช้จะค้างอยู่หน้าเดิมโดยใช้งานไม่ได้)
    if (
      typeof window !== 'undefined' &&
      err.response?.status === 401 &&
      err.response?.data?.code === 'SESSION_REPLACED' &&
      !err.config?.authToken
    ) {
      // คำตอบเก่าของคำขอที่ส่งด้วยโทเคนเดิม (เช่น poll ที่ค้างอยู่) มาถึงหลังจากเครื่องนี้ล็อกอินใหม่แล้ว → ไม่ใช่เซสชันปัจจุบัน ห้ามล้างโทเคนใหม่ทิ้ง
      const sentToken = String(err.config?.headers?.Authorization || '').replace(/^Bearer /, '');
      if (sentToken !== (localStorage.getItem('token') || '')) return Promise.reject(err);
      clearSession();
      setAuthNotice(err.response.data.message);
      window.dispatchEvent(new Event(USER_EVENT)); // ให้ Header/เมนู/Badge กลับเป็นสถานะยังไม่ล็อกอินทันที
      if (!window.location.pathname.startsWith('/login')) {
        const here = window.location.pathname + window.location.search;
        window.location.href = `/login?next=${encodeURIComponent(here)}`;
      }
      return Promise.reject(err);
    }
    if (typeof window !== 'undefined' && !isAuthCall(err.config?.url) && !err.config?.skipAuthRedirect && !err.config?.authToken) {
      const status = err.response?.status;
      const banned = status === 403 && err.response?.data?.code === 'BANNED';
      if (status === 401 || banned) {
        const previousToken = localStorage.getItem('token') || '';
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (banned) {
          // คำขอที่ล้มพร้อมกันหลายตัว: ตัวแรกล้างโทเคนไปแล้ว ตัวถัดไปอ่านได้ค่าว่าง — อย่าเขียนทับเซสชันอุทธรณ์ที่ถูกต้อง
          if (previousToken || !getAppealSession()) {
            setAppealSession({ token: previousToken, message: err.response.data.message, reason: err.response.data.banReason || '' });
          }
          if (!window.location.pathname.startsWith('/suspended')) window.location.href = '/suspended';
        } else if (!window.location.pathname.startsWith('/login')) {
          const here = window.location.pathname + window.location.search;
          window.location.href = `/login?next=${encodeURIComponent(here)}`;
        }
      }
    }
    return Promise.reject(err);
  }
);

// ออกจากระบบ: แจ้งเซิร์ฟเวอร์ล้างเซสชัน (โทเคนที่ถืออยู่ใช้ไม่ได้อีก) แล้วล้างข้อมูลในเครื่อง
// ต้องส่งโทเคนไปกับคำขอเองเพราะ clearSession() ด้านล่างลบ localStorage ก่อนที่ interceptor จะอ่านค่า — ล้มเหลวก็ไม่เป็นไร (ออกจากระบบฝั่งเครื่องนี้แล้ว)
export function signOut() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  if (token) API.post('/auth/logout', null, { authToken: token, skipAuthRedirect: true }).catch(() => {});
  clearSession();
}

// ดึงข้อความ error ที่อ่านรู้เรื่องจาก response
export const errorMessage = (err, fallback = 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง') =>
  err?.response?.data?.message || (err?.request && !err?.response ? 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้' : fallback);

export default API;
