import type { ErrorCode } from '@finpilot/shared';

/** An expected failure with an HTTP status and a stable, client-facing code. */
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: { field?: string; message: string }[],
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (what: string) => new AppError(404, 'NOT_FOUND', `${what} not found`);

export const unprocessable = (message: string, details?: { field?: string; message: string }[]) =>
  new AppError(422, 'UNPROCESSABLE', message, details);
