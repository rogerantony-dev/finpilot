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
    <main className="grid min-h-dvh place-items-center bg-gray-0 px-4 py-12">
      <div className="w-full max-w-[300px]">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span
            aria-hidden
            className="flex size-9 items-center justify-center rounded-xl bg-gray-950 text-sm font-semibold text-gray-0 shadow-custom-2"
          >
            F
          </span>
          <div>
            <h1 className="text-lg font-semibold tracking-[-0.01em] text-gray-900">
              Sign in to FinPilot
            </h1>
            <p className="mt-1 text-13 tracking-[0.01em] text-gray-500">
              Wealth service desk · internal use
            </p>
          </div>
        </div>

        <Form errors={errors} onSubmit={handleSubmit} noValidate className="gap-3">
          <Field.Root name="email">
            <Field.Label className="sr-only">Email</Field.Label>
            <Field.Control
              type="email"
              autoComplete="username"
              aria-required
              autoFocus
              placeholder="Email"
              className="h-10"
            />
            <Field.Error />
          </Field.Root>
          <Field.Root name="password">
            <Field.Label className="sr-only">Password</Field.Label>
            <Field.Control
              type="password"
              autoComplete="current-password"
              aria-required
              placeholder="Password"
              className="h-10"
            />
            <Field.Error />
          </Field.Root>

          {formError && (
            <p role="alert" className="rounded-lg bg-red-100 px-3 py-2 text-13 text-red-700">
              {formError}
            </p>
          )}

          <Button
            type="submit"
            disabled={login.isPending}
            className="mt-1 h-10 w-full rounded-[12px] text-sm"
          >
            {login.isPending ? 'Signing in…' : 'Continue'}
          </Button>
        </Form>
        <p className="mt-6 text-center text-xs text-gray-400">
          Synthetic data only. Demo credentials are in the README.
        </p>
      </div>
    </main>
  );
}
