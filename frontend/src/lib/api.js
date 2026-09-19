import axios from 'axios';

const API = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
});

// แนบ JWT Token เข้า Header อัตโนมัติถ้ามีการ Login แล้ว
API.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const isAuthCall = (url = '') =>
  ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/verify-otp', '/auth/reset-password'].some((p) =>
    url.startsWith(p)
  );

// Token หมดอายุ / บัญชีถูกแบน → ล้างเซสชันแล้วพาไปหน้า Login
API.interceptors.response.use(
  (res) => res,
  (err) => {
    // skipAuthRedirect = คำขอเบื้องหลัง (เช่น แจ้งเตือน) ที่ไม่ควรเด้งผู้ใช้ไปหน้า Login เอง
    if (typeof window !== 'undefined' && !isAuthCall(err.config?.url) && !err.config?.skipAuthRedirect) {
      const status = err.response?.status;
      const banned = status === 403 && err.response?.data?.code === 'BANNED';
      if (status === 401 || banned) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (banned) {
          try {
            sessionStorage.setItem('authNotice', err.response.data.message);
          } catch {
            /* ignore */
          }
        }
        if (!window.location.pathname.startsWith('/login')) {
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
