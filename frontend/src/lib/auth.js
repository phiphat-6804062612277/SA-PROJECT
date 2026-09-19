// ฟังก์ชันช่วยจัดการเซสชันฝั่ง browser (เก็บ token/user ไว้ใน localStorage)

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
}

export function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

// ป้องกัน open redirect: อนุญาตเฉพาะ path ภายในเว็บ เช่น /checkout
export function safeNext(next, fallback) {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : fallback;
}

export const homeFor = (user) => (user?.role === 'seller' ? '/seller' : '/shopping');

export const baht = (n) => Number(n || 0).toLocaleString('th-TH');
