import { loginRequest } from '@finpilot/shared';
import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { Button, Field, Form, type FormErrors } from '../../components/ui';
import { ApiError } from '../../lib/api';
import { issuesToErrors } from '../../lib/form-errors';
import { useLogin, useSession } from './session';

/** Only allow redirects to paths inside this app. */
const safeNext = (next: string | null) =>
  next && next.startsWith('/') && !next.startsWith('//') ? next : '/';

export function LoginPage() {
  const session = useSession();
  const login = useLogin();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [errors, setErrors] = useState<FormErrors>({});
  const next = safeNext(params.get('next'));

  if (session.data) return <Navigate to={next} replace />;

  const formError =
    login.error instanceof ApiError && login.error.status !== 400 ? login.error.message : null;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = loginRequest.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (!parsed.success) {
      setErrors(issuesToErrors(parsed.error.issues));
      return;
    }
    setErrors({});
    login.mutate(parsed.data, { onSuccess: () => navigate(next, { replace: true }) });
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-12">
      <div className="w-full max-w-sm animate-rise">
        <p className="mb-8 text-center font-display text-3xl tracking-tight text-ink">
          Fin<span className="italic text-accent">Pilot</span>
        </p>
        <div className="rounded-xl border border-line bg-surface p-7 shadow-[0_24px_48px_-24px_rgb(27_26_23/0.25)]">
          <h1 className="font-display text-2xl text-ink">Sign in</h1>
          <p className="mt-1 mb-6 text-sm text-muted">Wealth service desk · internal use</p>

          <Form errors={errors} onSubmit={handleSubmit} noValidate>
            <Field.Root name="email">
              <Field.Label>Email</Field.Label>
              <Field.Control type="email" autoComplete="username" aria-required autoFocus />
              <Field.Error />
            </Field.Root>
            <Field.Root name="password">
              <Field.Label>Password</Field.Label>
              <Field.Control type="password" autoComplete="current-password" aria-required />
              <Field.Error />
            </Field.Root>

            {formError && (
              <p
                role="alert"
                className="rounded-md border border-loss/25 bg-loss-soft px-3 py-2 text-sm text-loss"
              >
                {formError}
              </p>
            )}

            <Button type="submit" disabled={login.isPending} className="mt-1 w-full">
              {login.isPending ? 'Signing in…' : 'Sign in'}
            </Button>
          </Form>
        </div>
        <p className="mt-6 text-center text-xs text-muted">
          Synthetic data only. Demo credentials are in the README.
        </p>
      </div>
    </main>
  );
}
