import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Join class names and let later Tailwind classes override earlier ones. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Base UI accepts `className` as a string or as a function of component state.
 * Merge wrapper defaults with a caller's className in either form.
 */
export function mergeClassName<State>(
  base: string | ((state: State) => string),
  className: string | ((state: State) => string | undefined) | undefined,
): string | ((state: State) => string) {
  if (typeof base === 'string' && typeof className !== 'function') return cn(base, className);
  return (state: State) =>
    cn(
      typeof base === 'function' ? base(state) : base,
      typeof className === 'function' ? className(state) : className,
    );
}
