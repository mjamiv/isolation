interface IconButtonProps {
  onClick: () => void;
  title: string;
  variant?: 'default' | 'danger';
  disabled?: boolean;
  'aria-label'?: string;
  children: React.ReactNode;
}

export function IconButton({
  onClick,
  title,
  variant = 'default',
  disabled,
  'aria-label': ariaLabel,
  children,
}: IconButtonProps) {
  const base =
    'inline-flex items-center justify-center rounded-md p-1 transition-all duration-150 disabled:opacity-30';
  const variants = {
    default: 'text-white/30 hover:bg-white/[0.06] hover:text-white/60',
    danger: 'text-white/30 hover:bg-red-500/10 hover:text-red-400',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel ?? title}
      disabled={disabled}
      className={`${base} ${variants[variant]}`}
    >
      {children}
    </button>
  );
}
