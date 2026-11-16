import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { request } from './api';
export interface Collection<T> {
  data: T[];
  page: { nextCursor: string | null };
}
export function useCollection<T>(path: string, revision: number, poll = false) {
  const [state, setState] = useState<{
    data: T[];
    cursor: string | null;
    loading: boolean;
    error: string;
  }>({ data: [], cursor: null, loading: true, error: '' });
  const generation = useRef(0),
    previousPath = useRef(path),
    loadingMore = useRef(false),
    pullBusy = useRef(false),
    visibleCount = useRef(20);
  useEffect(() => {
    let disposed = false,
      timer: ReturnType<typeof setTimeout> | undefined;
    generation.current++;
    loadingMore.current = false;
    pullBusy.current = false;
    const same = previousPath.current === path;
    previousPath.current = path;
    if (!same) visibleCount.current = 20;
    setState((s) => ({
      data: same ? s.data : [],
      cursor: same ? s.cursor : null,
      loading: true,
      error: '',
    }));
    async function load() {
      if (disposed) return;
      if (
        pullBusy.current ||
        loadingMore.current ||
        (poll && document.hidden)
      ) {
        if (poll) timer = setTimeout(load, 5000);
        return;
      }
      pullBusy.current = true;
      try {
        let cursor: string | null = null;
        const collected: T[] = [];
        do {
          const r: Collection<T> = await request(
            path +
              (path.includes('?') ? '&' : '?') +
              'limit=20' +
              (cursor ? '&cursor=' + cursor : ''),
          );
          collected.push(...r.data);
          cursor = r.page.nextCursor;
        } while (cursor && collected.length < visibleCount.current);
        if (!disposed)
          setState({ data: collected, cursor, loading: false, error: '' });
      } catch (e) {
        if (!disposed)
          setState((s) => ({
            ...s,
            loading: false,
            error: (e as Error).message,
          }));
      } finally {
        if (!disposed) {
          pullBusy.current = false;
          if (poll) timer = setTimeout(load, 5000);
        }
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
      disposed = true;
      generation.current++;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [path, revision, poll]);
  async function more() {
    if (
      !state.cursor ||
      state.loading ||
      loadingMore.current ||
      pullBusy.current
    )
      return;
    loadingMore.current = true;
    const current = generation.current;
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const r = await request<Collection<T>>(
        path +
          (path.includes('?') ? '&' : '?') +
          'limit=20&cursor=' +
          state.cursor,
      );
      if (current !== generation.current) return;
      visibleCount.current = state.data.length + r.data.length;
      setState((s) => ({
        ...s,
        data: [...s.data, ...r.data],
        cursor: r.page.nextCursor,
        loading: false,
      }));
    } catch (e) {
      if (current === generation.current)
        setState((s) => ({
          ...s,
          loading: false,
          error: (e as Error).message,
        }));
    } finally {
      if (current === generation.current) loadingMore.current = false;
    }
  }
  return {
    ...state,
    data: previousPath.current === path ? state.data : [],
    more,
  };
}
export function CollectionFooter({
  list,
}: {
  list: {
    loading: boolean;
    error: string;
    cursor: string | null;
    more: () => Promise<void>;
  };
}) {
  return (
    <>
      {list.loading && <p role="status">Cargando…</p>}
      {list.error && (
        <p role="alert" className="cup-message error">
          {list.error}
        </p>
      )}
      {list.cursor && (
        <button
          type="button"
          className="cup-secondary"
          disabled={list.loading}
          onClick={() => void list.more()}
        >
          Cargar más
        </button>
      )}
    </>
  );
}
export function ActionForm({
  children,
  action,
  onSuccess,
  submit = 'Guardar',
  reset = false,
}: {
  children: ReactNode;
  action: (data: FormData) => Promise<unknown>;
  onSuccess?: () => void;
  submit?: string;
  reset?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError('');
    try {
      await action(new FormData(form));
      if (reset) form.reset();
      onSuccess?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={send}>
      <fieldset disabled={busy}>
        {children}
        {error && (
          <p role="alert" className="cup-message error">
            {error}
          </p>
        )}
        <button type="submit">{busy ? 'Guardando…' : submit}</button>
      </fieldset>
    </form>
  );
}
export function ActionButton({
  children,
  action,
  onSuccess,
  confirm,
}: {
  children: ReactNode;
  action: () => Promise<unknown>;
  onSuccess: () => void;
  confirm?: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <span className="smc-action">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          if (confirm && !window.confirm(confirm)) return;
          setBusy(true);
          setError('');
          try {
            await action();
            onSuccess();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Guardando…' : children}
      </button>
      {error && (
        <span role="alert" className="smc-error">
          {error}
        </span>
      )}
    </span>
  );
}
export function TextField({
  label,
  name,
  initial = '',
  type = 'text',
  maxLength = 120,
  minLength,
  required = true,
}: {
  label: string;
  name: string;
  initial?: string;
  type?: string;
  maxLength?: number;
  minLength?: number;
  required?: boolean;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        type={type}
        defaultValue={initial}
        required={required}
        maxLength={maxLength}
        minLength={minLength}
        autoComplete={type === 'password' ? 'new-password' : undefined}
      />
    </label>
  );
}
export const text = (data: FormData, key: string) =>
  String(data.get(key) ?? '');
