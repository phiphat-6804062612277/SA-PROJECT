import axios from 'axios';
import { getAppealSession, setAppealSession } from '@/lib/auth';

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

// ดึงข้อความ error ที่อ่านรู้เรื่องจาก response
export const errorMessage = (err, fallback = 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง') =>
  err?.response?.data?.message || (err?.request && !err?.response ? 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้' : fallback);

export default API;
