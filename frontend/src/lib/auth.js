// ฟังก์ชันช่วยจัดการเซสชันฝั่ง browser (เก็บ token/user ไว้ใน localStorage)

export const USER_EVENT = 'solify:user';

export function getStoredUser() {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
}

export function hasToken() {
  return typeof window !== 'undefined' && !!localStorage.getItem('token');
}

export function saveSession({ token, user }) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

export function updateStoredUser(user) {
  localStorage.setItem('user', JSON.stringify(user));
  // แจ้ง Header/เมนูให้รีเฟรชรูปโปรไฟล์และชื่อทันที (ไม่ต้องรีโหลดหน้า)
  window.dispatchEvent(new Event(USER_EVENT));
}

export function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

// ข้อความที่อยากให้หน้า Login แสดงหลังถูกเด้งออก (เช่น บัญชีถูกระงับ)
export function setAuthNotice(text) {
  try {
    sessionStorage.setItem('authNotice', text);
  } catch {
    /* ignore */
  }
}
export function takeAuthNotice() {
  try {
    const t = sessionStorage.getItem('authNotice') || '';
    sessionStorage.removeItem('authNotice');
    return t;
  } catch {
    return '';
  }
}

// เซสชันชั่วคราวของผู้ใช้ที่ "ถูกแบน" (เก็บใน sessionStorage) — ใช้ในหน้า /suspended เพื่อยื่นอุทธรณ์ผ่านแชตซัพพอร์ตเท่านั้น
//   { token: appeal token หรือโทเคนเดิม, message: ข้อความแจ้งเตือน, reason: เหตุผลที่ถูกระงับ }
const APPEAL_KEY = 'appealSession';
export function setAppealSession({ token = '', message = '', reason = '' } = {}) {
  try {
    sessionStorage.setItem(APPEAL_KEY, JSON.stringify({ token, message, reason }));
  } catch {
    /* ignore */
  }
}
export function getAppealSession() {
  try {
    return JSON.parse(sessionStorage.getItem(APPEAL_KEY) || 'null');
  } catch {
    return null;
  }
}
export function clearAppealSession() {
  try {
    sessionStorage.removeItem(APPEAL_KEY);
  } catch {
    /* ignore */
  }
}

// ป้องกัน open redirect: อนุญาตเฉพาะ path ภายในเว็บ เช่น /checkout
export function safeNext(next, fallback) {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : fallback;
}

// หน้าแรกหลังล็อกอินของแต่ละบทบาท
export const homeFor = (user) => (user?.role === 'admin' ? '/admin' : user?.role === 'seller' ? '/seller' : '/');

export const baht = (n) => Number(n || 0).toLocaleString('th-TH');
