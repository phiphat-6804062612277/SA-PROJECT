'use client';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, CircleAlert, X } from 'lucide-react';

const ToastContext = createContext(null);

/**
 * ป๊อปอัปแจ้งเตือนสั้นๆ เด้งจากด้านบนของจอ หายเองใน ~3 วินาที
 *   const toast = useToast();
 *   toast.success('เพิ่มลงตะกร้าแล้ว', { label: 'ดูตะกร้า', href: '/cart' });
 *   toast.error('เกิดข้อผิดพลาด');
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback(
    (type, message, action) => {
      const id = ++idRef.current;
      setToasts((t) => [...t.slice(-2), { id, type, message, action }]); // แสดงพร้อมกันไม่เกิน 3 อัน
      setTimeout(() => dismiss(id), type === 'error' ? 4500 : 3000);
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      success: (m, a) => push('success', m, a),
      error: (m, a) => push('error', m, a),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed top-3 left-1/2 -translate-x-1/2 w-[92%] max-w-sm z-[100] space-y-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.type === 'error' ? 'alert' : 'status'}
            className={`toast-in pointer-events-auto flex items-center gap-2 rounded-2xl px-4 py-3 shadow-lg text-sm font-semibold ${
              t.type === 'error' ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'
            }`}
          >
            {t.type === 'error' ? (
              <CircleAlert size={18} className="shrink-0" />
            ) : (
              <CheckCircle2 size={18} className="shrink-0 text-emerald-400" />
            )}
            <span className="flex-1 text-wrap-safe">{t.message}</span>
            {t.action && (
              <Link href={t.action.href} onClick={() => dismiss(t.id)} className="text-cyan-300 font-bold underline shrink-0">
                {t.action.label}
              </Link>
            )}
            <button onClick={() => dismiss(t.id)} aria-label="ปิดข้อความ" className="opacity-70 hover:opacity-100 shrink-0">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast ต้องอยู่ภายใต้ <ToastProvider>');
  return ctx;
}
