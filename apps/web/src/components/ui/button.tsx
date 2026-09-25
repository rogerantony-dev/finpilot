import { Button as BaseButton } from '@base-ui/react/button';
import { cn, mergeClassName } from '../../lib/cn';

// Class patterns follow Recollect's buttons: near-black primary with a hairline
// shadow, alpha-gray secondary, and a quiet ghost for toolbar actions.
const base = [
  'relative inline-flex shrink-0 cursor-pointer appearance-none items-center justify-center gap-1.5',
  'align-middle whitespace-nowrap transition select-none [&_svg]:pointer-events-none [&_svg]:shrink-0',
  'text-13 leading-[115%] tracking-[0.01em]',
  'data-disabled:cursor-not-allowed data-disabled:opacity-50',
  'outline-none focus-visible:ring-2 focus-visible:ring-gray-200',
].join(' ');

const variants = {
  primary:
    'rounded-xl bg-gray-950 font-medium text-gray-0 shadow-custom-2 hover:not-data-disabled:bg-gray-700',
  secondary:
    'rounded-lg bg-gray-alpha-100 font-450 text-gray-800 hover:not-data-disabled:bg-gray-alpha-200 hover:text-gray-900',
  ghost:
    'rounded-lg font-450 text-gray-700 hover:not-data-disabled:bg-gray-100 hover:text-gray-900',
  danger:
    'rounded-xl bg-red-600 font-medium text-gray-0 shadow-custom-2 hover:not-data-disabled:bg-red-700',
} as const;

const sizes = {
  sm: 'h-7 px-2',
  md: 'h-8 px-3',
  icon: 'size-7',
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
      className={mergeClassName(cn(base, variants[variant], sizes[size]), className)}
      {...props}
    />
  );
}
