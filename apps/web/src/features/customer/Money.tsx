import { cn } from '../../lib/cn';
import { formatSignedMoney, signOf } from '../../lib/format';

/** Signed P/L amount coloured by direction (and not by colour alone: it carries +/−). */
export function Pnl({ value, className }: { value: string; className?: string }) {
  const sign = signOf(value);
  return (
    <span className={cn('numeric', sign > 0 && 'text-gain', sign < 0 && 'text-loss', className)}>
      {formatSignedMoney(value)}
    </span>
  );
}
