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
          className={cn(
            'text-13 leading-[115%] font-450 tracking-[0.01em] text-gray-600',
            hideLabel && 'sr-only',
          )}
        >
          {label}
        </BaseSelect.Label>
        <BaseSelect.Trigger
          className={cn(
            'flex h-8 w-full min-w-36 cursor-pointer items-center justify-between gap-2 rounded-lg bg-gray-alpha-100 pr-1.5 pl-2.5 text-left',
            'text-13 leading-[115%] font-450 tracking-[0.01em] text-gray-800 outline-hidden transition-colors',
            'hover:not-data-disabled:bg-gray-alpha-200 focus-visible:ring-1 focus-visible:ring-gray-300',
            'data-disabled:opacity-60 data-popup-open:bg-gray-alpha-200',
          )}
        >
          <BaseSelect.Value
            className="truncate data-placeholder:text-gray-alpha-600"
            placeholder={placeholder}
          />
          <BaseSelect.Icon className="text-gray-500">
            <ChevronsUpDown size={13} aria-hidden />
          </BaseSelect.Icon>
        </BaseSelect.Trigger>
      </div>
      <BaseSelect.Portal>
        <BaseSelect.Positioner
          className="z-50 outline-none select-none"
          sideOffset={6}
          alignItemWithTrigger={false}
        >
          <BaseSelect.Popup
            className={cn(
              'max-h-[min(var(--available-height),20rem)] min-w-[var(--anchor-width)] origin-(--transform-origin) overflow-y-auto rounded-xl bg-gray-50 p-1',
              'shadow-custom-3 ring-1 ring-black/5 outline-hidden transition-[transform,scale,opacity] motion-reduce:transition-none',
              'data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0',
            )}
          >
            <BaseSelect.List>
              {options.map((o) => (
                <BaseSelect.Item
                  key={o.value}
                  value={o.value}
                  className="grid cursor-pointer grid-cols-[0.875rem_1fr] items-center gap-1.5 rounded-lg px-2 py-[5px] text-13 leading-[115%] font-450 tracking-[0.01em] text-gray-800 outline-hidden select-none data-highlighted:bg-gray-200 data-highlighted:text-gray-900"
                >
                  <BaseSelect.ItemIndicator className="text-gray-800">
                    <Check size={13} aria-hidden />
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
