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
      <label htmlFor={id} className="shrink-0 text-xs text-gray-400 w-12">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        disabled={disabled}
        className="w-full rounded bg-gray-800 px-2 py-1 text-xs text-gray-200 outline-none ring-1 ring-gray-700 focus:ring-blue-500 disabled:opacity-50"
      />
    </div>
  );
}
