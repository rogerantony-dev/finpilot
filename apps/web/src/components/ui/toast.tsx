import { Toast } from '@base-ui/react/toast';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

/** Wrap the app once; call `useToast().add({ title, description })` anywhere below. */
export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <Toast.Provider limit={3}>
      {children}
      <Toast.Portal>
        <Toast.Viewport className="fixed right-4 bottom-4 z-[60] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((toast) => (
    <Toast.Root
      key={toast.id}
      toast={toast}
      className="relative rounded-lg border border-line bg-ink px-4 py-3 pr-10 text-surface shadow-xl transition-all duration-300 data-ending-style:translate-y-2 data-ending-style:opacity-0 data-starting-style:translate-y-2 data-starting-style:opacity-0"
    >
      <Toast.Title className="text-sm font-medium" />
      <Toast.Description className="mt-0.5 text-[13px] text-surface/75" />
      <Toast.Close
        aria-label="Dismiss"
        className="absolute top-2.5 right-2.5 rounded p-1 text-surface/70 hover:text-surface"
      >
        <X size={14} aria-hidden />
      </Toast.Close>
    </Toast.Root>
  ));
}

export const useToast = Toast.useToastManager;
