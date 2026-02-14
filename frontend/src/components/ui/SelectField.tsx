import { useId } from 'react';

interface SelectFieldProps {
  label: string;
  value: string | number;
  options: { value: string | number; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  disabled,
  className = '',
}: SelectFieldProps) {
  const id = useId();
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label htmlFor={id} className="shrink-0 text-xs text-gray-400 w-12">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded bg-gray-800 px-2 py-1 text-xs text-gray-200 outline-none ring-1 ring-gray-700 focus:ring-yellow-500 disabled:opacity-50"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
