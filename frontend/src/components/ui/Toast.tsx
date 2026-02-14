import { useToastStore, type ToastType } from '@/stores/toastStore';

const TYPE_STYLES: Record<ToastType, string> = {
  success: 'border-yellow-500 bg-yellow-900/80 text-yellow-200',
  error: 'border-red-500 bg-red-900/80 text-red-200',
  info: 'border-yellow-400 bg-gray-800/90 text-yellow-100',
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
          className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 shadow-lg backdrop-blur transition-all ${TYPE_STYLES[toast.type]}`}
        >
          <span className="text-sm font-bold">{TYPE_ICONS[toast.type]}</span>
          <span className="max-w-xs text-xs">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
