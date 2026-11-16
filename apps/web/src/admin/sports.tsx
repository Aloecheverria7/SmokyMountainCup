import { useEffect, useRef, useState } from 'react';
import { ApiError, request } from './api';
import { CollectionFooter, useCollection } from './components';
import type { Competition, Season } from './types';
export function useResource<T>(
  path: string | null,
  revision: number,
  poll = false,
) {
  const [state, setState] = useState<{
    data: T | null;
    error: string;
    loading: boolean;
  }>({ data: null, error: '', loading: true });
  function merged(current: typeof state, data: T) {
    const before = (current.data as any)?.data,
      after = (data as any)?.data;
    if (
      before?.id === after?.id &&
      typeof before?.version === 'number' &&
      typeof after?.version === 'number' &&
      before.version > after.version
    )
      return { ...current, loading: false };
    return { data, error: '', loading: false };
  }
  const previous = useRef(path);
  useEffect(() => {
    let disposed = false,
      timer: ReturnType<typeof setTimeout> | undefined;
    const same = previous.current === path;
    previous.current = path;
    setState((s) => ({
      data: same ? s.data : null,
      error: '',
      loading: !!path,
    }));
    if (!path) return;
    async function load() {
      try {
        const data = await request<T>(path!);
        if (!disposed) setState((current) => merged(current, data));
      } catch (e) {
        if (!disposed)
          setState((s) => ({
            ...s,
            error: (e as Error).message,
            loading: false,
          }));
      } finally {
        if (!disposed && poll) timer = setTimeout(load, 5000);
      }
    }
    void load();
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [path, revision, poll]);
  return {
    ...state,
    data: previous.current === path ? state.data : null,
    update: (data: T) => setState((current) => merged(current, data)),
  };
}
export function useCompetition(revision: number) {
  const seasons = useCollection<Season>('seasons', revision);
  const [sid, setSid] = useState(''),
    [cid, setCid] = useState('');
  const seasonId = seasons.data.some((s) => s.id === sid)
    ? sid
    : (seasons.data.find((s) => s.active)?.id ?? seasons.data[0]?.id ?? '');
  const resource = useResource<{ data: Competition[] }>(
    seasonId ? `seasons/${seasonId}/competitions` : null,
    revision,
  );
  const competition =
    resource.data?.data.find((c) => c.id === cid) ?? resource.data?.data[0];
  const selector = (
    <div className="cup-toolbar">
      <label>
        Temporada
        <select
          value={seasonId}
          onChange={(e) => {
            setSid(e.target.value);
            setCid('');
          }}
        >
          <option value="" disabled>
            Selecciona una temporada
          </option>
          {seasons.data.map((s) => (
            <option value={s.id} key={s.id}>
              {s.name}
              {s.archived ? ' · Archivada' : ''}
            </option>
          ))}
        </select>
      </label>
      <label>
        Competición
        <select
          value={competition?.id ?? ''}
          onChange={(e) => setCid(e.target.value)}
        >
          <option value="" disabled>
            Selecciona una competición
          </option>
          {resource.data?.data.map((c) => (
            <option value={c.id} key={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <CollectionFooter list={seasons} />
      {resource.error && <p role="alert">{resource.error}</p>}
    </div>
  );
  return { competition, selector, seasonId };
}
interface PendingOperation {
  path: string;
  method: string;
  body: any;
  key: string;
}
export function useOperation(scope: string) {
  const storageKey = 'smc-operation:' + scope;
  const [pending, setPending] = useState<PendingOperation | null>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');
    } catch {
      return null;
    }
  });
  const current = useRef(pending),
    busy = useRef(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    try {
      const p = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');
      current.current = p;
      setPending(p);
      setError('');
    } catch {
      current.current = null;
      setPending(null);
    }
  }, [storageKey]);
  function save(value: PendingOperation | null) {
    current.current = value;
    setPending(value);
    if (value) sessionStorage.setItem(storageKey, JSON.stringify(value));
    else sessionStorage.removeItem(storageKey);
  }
  async function perform(operation: PendingOperation) {
    if (busy.current) throw Error('Espera a que termine la operación actual.');
    busy.current = true;
    setSending(true);
    setError('');
    save(operation);
    try {
      const result = await request(
        operation.path,
        operation.method,
        operation.body,
        { key: operation.key },
      );
      save(null);
      return result;
    } catch (e) {
      if (e instanceof ApiError && e.status < 500) save(null);
      setError((e as Error).message);
      throw e;
    } finally {
      busy.current = false;
      setSending(false);
    }
  }
  async function execute(path: string, body: any, method = 'POST') {
    if (current.current)
      throw Error(
        'Hay una operación pendiente. Reinténtala con el botón de recuperación antes de registrar otra.',
      );
    return perform({ path, method, body, key: crypto.randomUUID() });
  }
  const retry = async () => {
    if (current.current) return perform(current.current);
  };
  return { execute, retry, pending, error, sending };
}
export function PendingNotice({
  operation,
  refresh,
}: {
  operation: ReturnType<typeof useOperation>;
  refresh: () => void;
}) {
  const [busy, setBusy] = useState(false);
  if (!operation.pending) return null;
  if (operation.sending) return <p role="status">Guardando operación…</p>;
  return (
    <div className="cup-stale" role="status">
      <p>
        No se pudo confirmar la respuesta de una operación. Reintenta para
        comprobarla sin duplicarla.
      </p>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await operation.retry();
            refresh();
          } catch {
          } finally {
            setBusy(false);
          }
        }}
      >
        Reintentar operación pendiente
      </button>
      {operation.error && <p role="alert">{operation.error}</p>}
    </div>
  );
}
