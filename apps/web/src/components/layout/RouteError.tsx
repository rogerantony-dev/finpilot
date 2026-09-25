import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

/** Error boundary for router errors (render crashes, unmatched routes outside the shell). */
export function RouteError() {
  const error = useRouteError();
  return <ErrorPage notFound={isRouteErrorResponse(error) && error.status === 404} />;
}

/** Catch-all route for unknown URLs inside the app shell. */
export function NotFoundPage() {
  return <ErrorPage notFound />;
}

function ErrorPage({ notFound }: { notFound: boolean }) {
  return (
    <main className="grid min-h-[60dvh] place-items-center px-4 text-center">
      <div>
        <p className="font-display text-5xl text-line-strong">{notFound ? '404' : 'Oops'}</p>
        <h1 className="mt-2 font-display text-2xl">
          {notFound ? 'Page not found' : 'Something went wrong'}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {notFound
            ? 'That page does not exist.'
            : 'The page hit an unexpected error. Reloading usually helps.'}
        </p>
        <Link
          to="/"
          className="mt-6 inline-block text-sm font-medium text-accent underline-offset-4 hover:underline"
        >
          Back to customers
        </Link>
      </div>
    </main>
  );
}
