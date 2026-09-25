import { Form as BaseForm } from '@base-ui/react/form';
import { mergeClassName } from '../../lib/cn';

export type FormErrors = Record<string, string | string[]>;

/** Form that shows `errors[name]` under each named Field (client or server errors). */
export function Form({ className, ...props }: BaseForm.Props) {
  return <BaseForm className={mergeClassName('flex flex-col gap-4', className)} {...props} />;
}
