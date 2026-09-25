import { useSearchParams } from 'react-router';

/**
 * Filter/sort/page state kept in the URL query string, so refresh, back/forward
 * and shared links all preserve it. Changing any filter resets to page 1.
 */
export function useUrlState<K extends string>(keys: readonly K[]) {
  const [params, setParams] = useSearchParams();
  const values = Object.fromEntries(keys.map((k) => [k, params.get(k) ?? ''])) as Record<K, string>;

  function update(changes: Partial<Record<K | 'page', string | number>>) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) {
          if (value === '' || value === undefined || value === null) next.delete(key);
          else next.set(key, String(value));
        }
        if (!('page' in changes)) next.delete('page');
        return next;
      },
      { replace: true },
    );
  }

  const page = Math.max(1, Number(params.get('page')) || 1);
  return { values, page, update, clear: () => setParams(new URLSearchParams(), { replace: true }) };
}
