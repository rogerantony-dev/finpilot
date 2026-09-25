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
        <p className="text-13 font-450 text-gray-500">{notFound ? '404' : 'Error'}</p>
        <h1 className="mt-1 text-xl font-semibold tracking-[-0.01em] text-gray-900">
          {notFound ? 'Page not found' : 'Something went wrong'}
        </h1>
        <p className="mt-1 text-13 tracking-[0.01em] text-gray-600">
          {notFound
            ? 'That page does not exist.'
            : 'The page hit an unexpected error. Reloading usually helps.'}
        </p>
        <Link
          to="/"
          className="mt-5 inline-flex h-8 items-center rounded-xl bg-gray-950 px-3 text-13 font-medium text-gray-0 shadow-custom-2 hover:bg-gray-700"
        >
          Back to customers
        </Link>
      </div>
    </main>
  );
}
