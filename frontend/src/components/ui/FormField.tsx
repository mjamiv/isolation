import { useId } from 'react';

interface FormFieldProps {
  label: string;
  value: string | number;
  type?: 'text' | 'number';
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  className?: string;
}

export function FormField({
  label,
  value,
  type = 'text',
  onChange,
  onBlur,
  disabled,
  className = '',
}: FormFieldProps) {
  const id = useId();
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label htmlFor={id} className="shrink-0 text-[11px] text-white/35 w-12">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        disabled={disabled}
        className="w-full rounded-md border border-white/[0.06] bg-surface-3 px-2 py-1 text-[11px] text-white/80 outline-none transition-colors duration-150 placeholder:text-white/20 focus:border-yellow-500/50 focus:bg-surface-4 disabled:opacity-40"
      />
    </div>
  );
}
