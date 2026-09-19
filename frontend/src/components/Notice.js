// กล่องข้อความแจ้งผล (แทน alert) — type: 'error' | 'success' | 'info'
const STYLES = {
  error: 'bg-red-50 text-red-600 border-red-100',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  info: 'bg-cyan-50 text-cyan-800 border-cyan-100',
};

export default function Notice({ type = 'info', children }) {
  if (!children) return null;
  return (
    <div role={type === 'error' ? 'alert' : 'status'} className={`text-xs font-semibold p-3 rounded-xl border ${STYLES[type]}`}>
      {children}
    </div>
  );
}
