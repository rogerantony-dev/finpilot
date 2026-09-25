import { Button as BaseButton } from '@base-ui/react/button';
import { cn, mergeClassName } from '../../lib/cn';

const variants = {
  primary:
    'bg-accent text-surface hover:not-data-disabled:bg-[#0b4a3a] shadow-[0_1px_0_rgb(0_0_0/0.15)]',
  secondary: 'border border-line-strong bg-surface text-ink hover:not-data-disabled:bg-paper',
  ghost: 'text-ink-soft hover:not-data-disabled:bg-ink/5',
  danger: 'bg-loss text-surface hover:not-data-disabled:bg-[#8a3123]',
} as const;

const sizes = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
  icon: 'size-8',
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
          'inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap select-none transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
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
