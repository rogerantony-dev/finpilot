import type { FormErrors } from '../components/ui';

/** Zod issues → { field: message }, keeping the first (most basic) problem per field. */
export function issuesToErrors(issues: { path: PropertyKey[]; message: string }[]): FormErrors {
  const errors: FormErrors = {};
  for (const issue of issues) {
    const field = String(issue.path[0] ?? '');
    if (field && !(field in errors)) errors[field] = issue.message;
  }
  return errors;
}
