import { Field as BaseField } from '@base-ui/react/field';
import { mergeClassName } from '../../lib/cn';

// Label, control, description and error are wired together by Base UI
// (ids, aria-describedby, aria-invalid), so forms are accessible by default.
// Inside <Form errors={...}>, Field.Error shows the server message for the
// field whose Root has the matching `name`.

const controlClass =
  'h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-muted/70 ' +
  'focus:outline-2 focus:-outline-offset-1 focus:outline-accent ' +
  'data-invalid:border-loss data-invalid:bg-loss-soft/40 data-disabled:bg-paper data-disabled:text-muted';

function Root({ className, ...props }: BaseField.Root.Props) {
  return (
    <BaseField.Root className={mergeClassName('flex flex-col gap-1.5', className)} {...props} />
  );
}

function Label({ className, ...props }: BaseField.Label.Props) {
  return (
    <BaseField.Label
      className={mergeClassName('text-[13px] font-medium text-ink-soft', className)}
      {...props}
    />
  );
}

function Control({ className, ...props }: BaseField.Control.Props) {
  return <BaseField.Control className={mergeClassName(controlClass, className)} {...props} />;
}

function Description({ className, ...props }: BaseField.Description.Props) {
  return (
    <BaseField.Description className={mergeClassName('text-xs text-muted', className)} {...props} />
  );
}

function Error({ className, ...props }: BaseField.Error.Props) {
  return (
    <BaseField.Error
      className={mergeClassName('text-xs font-medium text-loss', className)}
      {...props}
    />
  );
}

export const Field = { Root, Label, Control, Description, Error };
export { controlClass };
