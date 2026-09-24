import { Button as BaseButton } from '@base-ui/react/button';
import { cn, mergeClassName } from '../../lib/cn';

const variants = {
  primary: 'bg-slate-900 text-white hover:not-data-disabled:bg-slate-700',
  secondary: 'border border-slate-300 bg-white text-slate-900 hover:not-data-disabled:bg-slate-50',
  ghost: 'text-slate-700 hover:not-data-disabled:bg-slate-100',
  danger: 'bg-red-600 text-white hover:not-data-disabled:bg-red-500',
} as const;

const sizes = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
} as const;

export interface ButtonProps extends BaseButton.Props {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}

export function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  className,
  ...props
}: ButtonProps) {
  return (
    <BaseButton
      type={type}
      className={mergeClassName(
        cn(
          'inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap select-none',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900',
          'data-disabled:cursor-not-allowed data-disabled:opacity-50',
          variants[variant],
          sizes[size],
        ),
        className,
      )}
      {...props}
    />
  );
}
