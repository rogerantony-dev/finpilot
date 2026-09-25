import { Toast } from '@base-ui/react/toast';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

/** Wrap the app once; call `useToast().add({ title, description })` anywhere below. */
export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <Toast.Provider limit={3}>
      {children}
      <Toast.Portal>
        <Toast.Viewport className="fixed right-4 bottom-4 z-[60] flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-2 outline-0">
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
      className="relative rounded-2xl bg-gray-950 px-4 py-3 pr-10 text-gray-0 shadow-custom-4 transition-all duration-500 motion-reduce:transition-none ease-[cubic-bezier(0.22,1,0.36,1)] select-none data-ending-style:translate-y-[150%] data-ending-style:opacity-0 data-starting-style:translate-y-[150%]"
    >
      <Toast.Title className="text-13 leading-[115%] font-medium tracking-[0.01em]" />
      <Toast.Description className="mt-1 text-13 leading-[115%] tracking-[0.01em] text-gray-400" />
      <Toast.Close
        aria-label="Dismiss"
        className="absolute top-2.5 right-2.5 rounded-lg p-1 text-gray-500 hover:bg-white/10 hover:text-gray-0"
      >
        <X size={14} aria-hidden />
      </Toast.Close>
    </Toast.Root>
  ));
}

export const useToast = Toast.useToastManager;
