export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
let csrf = '',
  issued = 0,
  pending: Promise<string> | undefined;
async function csrfToken() {
  if (csrf && Date.now() - issued < 3000000) return csrf;
  if (pending) return pending;
  pending = fetch('/api/v1/auth/csrf', { cache: 'no-store' })
    .then(async (r) => {
      if (!r.ok) throw new ApiError(r.status, 'No se pudo preparar la sesión.');
      const data = await r.json();
      csrf = data.token;
      issued = Date.now();
      return csrf;
    })
    .finally(() => (pending = undefined));
  return pending;
}
export async function request<T = any>(
  path: string,
  method = 'GET',
  body?: unknown,
  options?: { key?: string },
): Promise<T> {
  const headers: Record<string, string> = {};
  if (method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    headers['X-CSRF-Token'] = await csrfToken();
  }
  if (options?.key) headers['Idempotency-Key'] = options.key;
  const r = await fetch('/api/v1/' + path, {
    method,
    headers,
    cache: 'no-store',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = r.status === 204 ? null : await r.json().catch(() => null);
  if (r.ok && r.status !== 204 && data === null)
    throw new ApiError(
      502,
      'Respuesta no válida. Reintenta la misma operación.',
    );
  if (!r.ok) {
    if (r.status === 401 && !path.endsWith('login'))
      window.dispatchEvent(new Event('smc-session-expired'));
    if (r.status === 403) {
      csrf = '';
      issued = 0;
    }
    const message =
      typeof data?.message === 'string'
        ? data.message
        : Array.isArray(data?.message)
          ? data.message.join(' ')
          : 'No se pudo completar la operación.';
    throw new ApiError(r.status, message);
  }
  if (['auth/login', 'auth/password', 'auth/logout'].includes(path)) {
    csrf = '';
    issued = 0;
  }
  return data as T;
}
