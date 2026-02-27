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
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-[11px] text-white/35 w-12">Fixity</span>
      <div className="flex gap-0.5">
        {DOF_LABELS.map((label, i) => (
          <button
            key={label}
            type="button"
            disabled={disabled}
            onClick={() => toggle(i)}
            className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] transition-all duration-150 ${
              value[i]
                ? 'bg-red-500/80 text-white shadow-sm'
                : 'border border-white/[0.06] bg-surface-3 text-white/25'
            } ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:border-yellow-500/30 cursor-pointer'}`}
            title={`${label}: ${value[i] ? 'Fixed' : 'Free'}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
