const DOF_LABELS = ['Tx', 'Ty', 'Tz', 'Rx', 'Ry', 'Rz'] as const;

interface FixityToggleProps {
  value: [boolean, boolean, boolean, boolean, boolean, boolean];
  onChange: (value: [boolean, boolean, boolean, boolean, boolean, boolean]) => void;
  disabled?: boolean;
}

export function FixityToggle({ value, onChange, disabled }: FixityToggleProps) {
  const toggle = (index: number) => {
    const next = [...value] as [boolean, boolean, boolean, boolean, boolean, boolean];
    next[index] = !next[index];
    onChange(next);
  };

  return (
    <div className="flex items-center gap-1">
      <span className="shrink-0 text-xs text-gray-400 w-12">Fixity</span>
      <div className="flex gap-0.5">
        {DOF_LABELS.map((label, i) => (
          <button
            key={label}
            type="button"
            disabled={disabled}
            onClick={() => toggle(i)}
            className={`rounded px-1.5 py-0.5 text-[10px] font-mono transition-colors ${
              value[i]
                ? 'bg-red-600 text-white'
                : 'bg-gray-800 text-gray-500 ring-1 ring-gray-700'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:ring-blue-500 cursor-pointer'}`}
            title={`${label}: ${value[i] ? 'Fixed' : 'Free'}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
