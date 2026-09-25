import type { ErrorResponse } from '@finpilot/shared';

/** A failed API call, carrying the server's error code, field details and request ID. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: { field?: string; message: string }[] = [],
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Query = Record<string, string | number | undefined | null>;

export function toSearch(query: Query = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

/**
 * Calls the FinPilot API. Same-origin (the dev server and the production
 * reverse proxy both serve /api), so the httpOnly session cookie is sent
 * automatically and never touched by JavaScript.
 */
export async function api<T>(
  path: string,
  options: { method?: string; query?: Query; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}${toSearch(options.query)}`, {
      method: options.method ?? 'GET',
      credentials: 'same-origin',
      headers: options.body === undefined ? undefined : { 'content-type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Cannot reach the server. Check your connection and try again.',
    );
  }

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const error = (body as ErrorResponse | null)?.error;
    throw new ApiError(
      res.status,
      error?.code ?? 'INTERNAL_ERROR',
      error?.message ?? `Request failed (${res.status})`,
      error?.details,
      error?.requestId,
    );
  }
  return body as T;
}
