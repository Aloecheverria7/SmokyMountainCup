import { useEffect, useState } from 'react';
export async function readPublic<T = any>(path: string): Promise<T> {
  const r = await fetch('/api/v1/public/' + path, {
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok)
    throw Error(
      r.status === 404 ? 'Not found.' : 'Results temporarily unavailable.',
    );
  return r.json();
}
export function usePublic<T>(path: string | null, poll = false) {
  const [state, setState] = useState<{
    data: T | null;
    error: string;
    loading: boolean;
  }>({ data: null, error: '', loading: true });
  useEffect(() => {
    let disposed = false,
      timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;
    setState({ data: null, error: '', loading: !!path });
    if (!path) return;
    async function load() {
      if (disposed || inFlight) return;
      if (poll && document.hidden) {
        timer = setTimeout(load, 5000);
        return;
      }
      inFlight = true;
      try {
        const data = await readPublic<T>(path!);
        if (!disposed) setState({ data, error: '', loading: false });
      } catch (e) {
        if (!disposed)
          setState((s) => ({
            ...s,
            error: (e as Error).message,
            loading: false,
          }));
      } finally {
        inFlight = false;
        if (!disposed && poll) timer = setTimeout(load, 5000);
      }
    }
    const visible = () => {
      if (poll && !document.hidden) {
        clearTimeout(timer);
        void load();
      }
    };
    document.addEventListener('visibilitychange', visible);
    void load();
    return () => {
      document.removeEventListener('visibilitychange', visible);
      disposed = true;
      clearTimeout(timer);
    };
  }, [path, poll]);
  return state;
}
