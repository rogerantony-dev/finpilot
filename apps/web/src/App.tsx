import type { HealthResponse } from '@finpilot/shared';
import { useQuery } from '@tanstack/react-query';
import { Button } from './components/ui';

async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch('/api/v1/health');
  // 503 still carries a valid body describing what is down.
  if (!res.ok && res.status !== 503) throw new Error(`API responded ${res.status}`);
  return res.json();
}

export function App() {
  const health = useQuery({ queryKey: ['health'], queryFn: fetchHealth });

  return (
    <main className="mx-auto max-w-xl p-6 font-sans text-slate-800">
      <h1 className="text-2xl font-semibold">FinPilot</h1>
      <p className="mt-1 text-sm text-slate-500">
        Portfolio &amp; goal monitoring (synthetic data)
      </p>

      <section aria-live="polite" className="mt-6 rounded-lg border border-slate-200 p-4 text-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">System status</h2>
          <Button
            variant="secondary"
            size="sm"
            disabled={health.isFetching}
            onClick={() => health.refetch()}
          >
            Recheck
          </Button>
        </div>
        {health.isPending && <p className="mt-2 text-slate-500">Checking…</p>}
        {health.isError && (
          <p className="mt-2 text-red-600">API unreachable: {health.error.message}</p>
        )}
        {health.data && (
          <dl className="mt-2 grid grid-cols-2 gap-y-1">
            <dt>API</dt>
            <dd>
              {health.data.status} (v{health.data.version})
            </dd>
            <dt>Database</dt>
            <dd>{health.data.checks.database}</dd>
          </dl>
        )}
      </section>
    </main>
  );
}
