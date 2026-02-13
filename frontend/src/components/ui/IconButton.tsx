interface IconButtonProps {
  onClick: () => void;
  title: string;
  variant?: 'default' | 'danger';
  disabled?: boolean;
  children: React.ReactNode;
}

export function IconButton({
  onClick,
  title,
  variant = 'default',
  disabled,
  children,
}: IconButtonProps) {
  const base = 'inline-flex items-center justify-center rounded p-1 transition-colors disabled:opacity-40';
  const variants = {
    default: 'text-gray-400 hover:bg-gray-700 hover:text-gray-200',
    danger: 'text-gray-400 hover:bg-red-900/50 hover:text-red-400',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`${base} ${variants[variant]}`}
    >
      {children}
    </button>
  );
}
