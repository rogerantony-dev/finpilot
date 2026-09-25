import { Select as BaseSelect } from '@base-ui/react/select';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  label: string;
  /** Visually hide the label (it stays available to screen readers). */
  hideLabel?: boolean;
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Form field name: the value is submitted with the form. */
  name?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/** Single-value select. The empty string is a valid option value (e.g. "All"). */
export function Select({
  label,
  hideLabel,
  options,
  value,
  defaultValue,
  onValueChange,
  name,
  placeholder,
  className,
  disabled,
}: SelectProps) {
  const items = Object.fromEntries(options.map((o) => [o.value, o.label]));
  return (
    <BaseSelect.Root
      items={items}
      value={value}
      defaultValue={defaultValue}
      onValueChange={(v) => onValueChange?.((v as string | null) ?? '')}
      name={name}
      disabled={disabled}
    >
      <div className={cn('flex flex-col gap-1.5', className)}>
        <BaseSelect.Label
          className={cn('text-[13px] font-medium text-ink-soft', hideLabel && 'sr-only')}
        >
          {label}
        </BaseSelect.Label>
        <BaseSelect.Trigger
          className={cn(
            'flex h-10 w-full min-w-36 items-center justify-between gap-2 rounded-md border border-line-strong bg-surface pr-2 pl-3 text-left text-sm text-ink',
            'hover:not-data-disabled:bg-paper focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-accent',
            'data-disabled:opacity-60 data-popup-open:bg-paper',
          )}
        >
          <BaseSelect.Value
            className="truncate data-placeholder:text-muted"
            placeholder={placeholder}
          />
          <BaseSelect.Icon className="text-muted">
            <ChevronsUpDown size={14} aria-hidden />
          </BaseSelect.Icon>
        </BaseSelect.Trigger>
      </div>
      <BaseSelect.Portal>
        <BaseSelect.Positioner
          className="z-50 outline-none"
          sideOffset={4}
          alignItemWithTrigger={false}
        >
          <BaseSelect.Popup
            className={cn(
              'max-h-[min(var(--available-height),20rem)] min-w-[var(--anchor-width)] origin-[var(--transform-origin)] overflow-y-auto rounded-md border border-line bg-surface py-1 text-sm shadow-lg shadow-ink/10',
              'transition-[scale,opacity] duration-100 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0',
            )}
          >
            <BaseSelect.List>
              {options.map((o) => (
                <BaseSelect.Item
                  key={o.value}
                  value={o.value}
                  className="grid cursor-default grid-cols-[1rem_1fr] items-center gap-2 py-1.5 pr-4 pl-2.5 outline-none select-none data-highlighted:bg-accent-soft data-selected:font-medium"
                >
                  <BaseSelect.ItemIndicator className="text-accent">
                    <Check size={14} aria-hidden />
                  </BaseSelect.ItemIndicator>
                  <BaseSelect.ItemText className="col-start-2">{o.label}</BaseSelect.ItemText>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}
