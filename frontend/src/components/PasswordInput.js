'use client';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { authInput } from '@/components/AuthShell';

// ช่องรหัสผ่านพร้อมปุ่มแสดง/ซ่อนรหัส
export default function PasswordInput({ id, value, onChange, placeholder = 'Enter password', autoComplete, minLength, required = true }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        minLength={minLength}
        maxLength={72}
        required={required}
        className={`${authInput} pr-10`}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        aria-label={show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 p-1"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
