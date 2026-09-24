import { Field as BaseField } from '@base-ui/react/field';
import { mergeClassName } from '../../lib/cn';

// Label, control, description and error are wired together by Base UI
// (ids, aria-describedby, aria-invalid), so forms are accessible by default.

function Root({ className, ...props }: BaseField.Root.Props) {
  return <BaseField.Root className={mergeClassName('flex flex-col gap-1', className)} {...props} />;
}

function Label({ className, ...props }: BaseField.Label.Props) {
  return (
    <BaseField.Label
      className={mergeClassName('text-sm font-medium text-slate-800', className)}
      {...props}
    />
  );
}

function Control({ className, ...props }: BaseField.Control.Props) {
  return (
    <BaseField.Control
      className={mergeClassName(
        'h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 ' +
          'focus:outline-2 focus:-outline-offset-1 focus:outline-slate-900 ' +
          'data-invalid:border-red-500 data-disabled:bg-slate-50 data-disabled:text-slate-500',
        className,
      )}
      {...props}
    />
  );
}

function Description({ className, ...props }: BaseField.Description.Props) {
  return (
    <BaseField.Description
      className={mergeClassName('text-xs text-slate-500', className)}
      {...props}
    />
  );
}

function Error({ className, ...props }: BaseField.Error.Props) {
  return (
    <BaseField.Error className={mergeClassName('text-xs text-red-600', className)} {...props} />
  );
}

export const Field = { Root, Label, Control, Description, Error };
