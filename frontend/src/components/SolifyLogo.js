// โลโก้ Solify: แผงโซลาร์เซลล์ + ดวงอาทิตย์ (วาดเป็น SVG ไม่ต้องใช้ไฟล์ภาพ)
export default function SolifyLogo({ size = 150, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      role="img"
      aria-label="Solify"
      className={className}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* รังสีดวงอาทิตย์ */}
      <g stroke="#334155" strokeWidth="6">
        <path d="M62 18l5 10M96 8v12M128 22l-8 9M146 48l-11 3M22 40l10 6" />
      </g>
      {/* ดวงอาทิตย์ */}
      <path d="M86 58a30 30 0 0 1 44-6" stroke="#f5d76e" strokeWidth="14" />
      {/* เงาแผง */}
      <path d="M118 96l30 34-58-4z" fill="#cfe0ee" stroke="none" />
      {/* แผงโซลาร์ */}
      <path d="M30 68l84 4 10 56-98-6z" fill="#fff" stroke="#334155" strokeWidth="7" />
      <path d="M50 70l6 54M76 70l8 56M34 96l88 4" stroke="#334155" strokeWidth="6" />
    </svg>
  );
}
