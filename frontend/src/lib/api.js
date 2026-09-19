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

// Token หมดอายุ/ไม่ถูกต้อง → ล้างเซสชันแล้วพาไปหน้า Login (ยกเว้นตอนกำลังล็อกอินอยู่)
API.interceptors.response.use(
  (res) => res,
  (err) => {
    const isAuthCall = err.config?.url?.startsWith('/auth/login') || err.config?.url?.startsWith('/auth/register');
    if (typeof window !== 'undefined' && err.response?.status === 401 && !isAuthCall) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      const here = window.location.pathname + window.location.search;
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = `/login?next=${encodeURIComponent(here)}`;
      }
    }
    return Promise.reject(err);
  }
);

// ดึงข้อความ error ที่อ่านรู้เรื่องจาก response
export const errorMessage = (err, fallback = 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง') =>
  err?.response?.data?.message || (err?.request && !err?.response ? 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้' : fallback);

export default API;
