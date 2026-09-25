import { Field as BaseField } from '@base-ui/react/field';
import { mergeClassName } from '../../lib/cn';

// Label, control, description and error are wired together by Base UI
// (ids, aria-describedby, aria-invalid), so forms are accessible by default.
// Inside <Form errors={...}>, Field.Error shows the server message for the
// field whose Root has the matching `name`.

/** Borderless alpha-gray input, as in Recollect. */
const controlClass =
  'h-8 w-full rounded-lg bg-gray-alpha-100 px-2.5 text-13 leading-[115%] tracking-[0.01em] text-gray-800 ' +
  'placeholder:text-gray-alpha-600 outline-hidden transition-colors ' +
  'hover:bg-gray-alpha-200 focus-visible:bg-gray-0 focus-visible:ring-1 focus-visible:ring-gray-300 ' +
  'data-invalid:bg-red-100/60 data-invalid:ring-1 data-invalid:ring-red-500/40 ' +
  'data-disabled:opacity-60';

function Root({ className, ...props }: BaseField.Root.Props) {
  return (
    <BaseField.Root className={mergeClassName('flex flex-col gap-1.5', className)} {...props} />
  );
}

function Label({ className, ...props }: BaseField.Label.Props) {
  return (
    <BaseField.Label
      className={mergeClassName(
        'text-13 leading-[115%] font-450 tracking-[0.01em] text-gray-600',
        className,
      )}
      {...props}
    />
  );
}

function Control({ className, ...props }: BaseField.Control.Props) {
  return <BaseField.Control className={mergeClassName(controlClass, className)} {...props} />;
}

function Description({ className, ...props }: BaseField.Description.Props) {
  return (
    <BaseField.Description
      className={mergeClassName('text-xs text-gray-500', className)}
      {...props}
    />
  );
}

function Error({ className, ...props }: BaseField.Error.Props) {
  return (
    <BaseField.Error
      className={mergeClassName('text-xs font-450 text-red-700', className)}
      {...props}
    />
  );
}

export const Field = { Root, Label, Control, Description, Error };
export { controlClass };
