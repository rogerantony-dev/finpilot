import type { ReactNode } from 'react';
import { ApiError } from '../../lib/api';
import { Button } from './button';

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 px-6 py-12 text-center">
      <p className="text-sm font-medium text-gray-900">{title}</p>
      {children && (
        <div className="max-w-sm text-13 leading-[138%] tracking-[0.01em] text-gray-500">
          {children}
        </div>
      )}
    </div>
  );
}

/** Shows what went wrong, a retry, and the request ID support would ask for. */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Something went wrong';
  const requestId = error instanceof ApiError ? error.requestId : undefined;
  return (
    <div role="alert" className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <p className="text-sm font-medium text-gray-900">Couldn’t load this</p>
      <p className="max-w-md text-13 leading-[138%] tracking-[0.01em] text-gray-500">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-1">
          Try again
        </Button>
      )}
      {requestId && <p className="font-mono text-[11px] text-gray-400">Reference {requestId}</p>}
    </div>
  );
}
