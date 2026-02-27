import { useToastStore, type ToastType } from '@/stores/toastStore';

const TYPE_STYLES: Record<ToastType, string> = {
  success: 'border-yellow-500/30 bg-yellow-900/40 text-yellow-200',
  error: 'border-red-500/30 bg-red-900/40 text-red-200',
  info: 'border-yellow-400/20 bg-surface-3 text-yellow-100',
};

const TYPE_ICONS: Record<ToastType, string> = {
  success: '\u2713',
  error: '\u2717',
  info: '\u2139',
};

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-4 top-14 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="alert"
          onClick={() => removeToast(toast.id)}
          className={`toast-enter flex cursor-pointer items-center gap-2.5 rounded-lg border px-4 py-2.5 shadow-lg shadow-black/20 backdrop-blur-md transition-all duration-200 hover:scale-[1.02] ${TYPE_STYLES[toast.type]}`}
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold">
            {TYPE_ICONS[toast.type]}
          </span>
          <span className="max-w-xs text-[11px] font-medium">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
