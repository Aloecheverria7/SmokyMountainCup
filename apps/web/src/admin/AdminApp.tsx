import { useEffect, useState } from 'react';
import { request, ApiError } from './api';
import {
  ActionForm,
  CollectionFooter,
  TextField,
  text,
  useCollection,
} from './components';
import { Seasons } from './Seasons';
import { Teams } from './Teams';
import { Users } from './Users';
import type { StaffUser } from './types';
import { Players } from './Players';
import { Venues } from './Venues';
import { Organization } from './Organization';
import { Matches } from './Matches';
import './admin.css';
function PasswordForm({ onChange }: { onChange: (user: StaffUser) => void }) {
  return (
    <section className="cup-panel">
      <h2>Cambiar contraseña</h2>
      <ActionForm
        submit="Cambiar contraseña"
        reset
        action={async (data) => {
          if (text(data, 'newPassword') !== text(data, 'confirmPassword'))
            throw new Error('Las contraseñas nuevas no coinciden.');
          const r = await request<{ data: StaffUser }>(
            'auth/password',
            'POST',
            {
              currentPassword: text(data, 'currentPassword'),
              newPassword: text(data, 'newPassword'),
            },
          );
          onChange(r.data);
        }}
      >
        <label>
          Contraseña actual
          <input
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
          />
        </label>
        <TextField
          label="Nueva contraseña"
          name="newPassword"
          type="password"
          minLength={12}
          maxLength={128}
        />
        <TextField
          label="Repite la nueva contraseña"
          name="confirmPassword"
          type="password"
          minLength={12}
          maxLength={128}
        />
      </ActionForm>
    </section>
  );
}
function Audit({ revision }: { revision: number }) {
  const list = useCollection<{
    id: string;
    actor: string | null;
    action: string;
    entity: string;
    entityId: string;
    createdAt: string;
    details: unknown;
  }>('audit', revision);
  return (
    <>
      <h1>Registro de cambios</h1>
      <p className="cup-muted">
        Las contraseñas y los tokens no se incluyen en este registro.
      </p>
      <div className="cup-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha UTC</th>
              <th>Usuario</th>
              <th>Acción</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {list.data.map((a) => (
              <tr key={a.id}>
                <td>
                  {new Date(a.createdAt)
                    .toISOString()
                    .replace('T', ' ')
                    .replace('Z', '')}
                </td>
                <td>{a.actor || 'Operador inicial'}</td>
                <td>
                  {a.action}
                  <small className="smc-block">
                    {a.entity} · {a.entityId}
                  </small>
                </td>
                <td>
                  <pre>
                    {typeof a.details === 'string'
                      ? a.details
                      : JSON.stringify(a.details, null, 2)}
                  </pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <CollectionFooter list={list} />
    </>
  );
}
export function AdminApp() {
  const [user, setUser] = useState<StaffUser | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [tab, setTab] = useState('seasons'),
    [revision, setRevision] = useState(0),
    [message, setMessage] = useState('');
  const refresh = () => {
    setRevision((v) => v + 1);
    setMessage('Cambios guardados.');
  };
  useEffect(() => {
    document.body.classList.add('cup-admin');
    document.body.classList.remove('cup-site');
    const title = document.title;
    document.title = 'Administración · Smoky Mountain Cup';
    let disposed = false;
    request<{ data: StaffUser }>('auth/me')
      .then((r) => {
        if (!disposed) setUser(r.data);
      })
      .catch((e) => {
        if (!disposed && !(e instanceof ApiError && e.status === 401))
          setError(e.message);
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    const expired = () => {
      setUser(null);
      setMessage('La sesión expiró. Vuelve a iniciar sesión.');
    };
    window.addEventListener('smc-session-expired', expired);
    return () => {
      disposed = true;
      document.body.classList.remove('cup-admin');
      document.body.classList.add('cup-site');
      document.title = title;
      window.removeEventListener('smc-session-expired', expired);
    };
  }, []);
  async function logout() {
    setError('');
    try {
      await request('auth/logout', 'POST');
      setUser(null);
      setMessage('Sesión cerrada.');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (loading)
    return (
      <main className="smc-staff cup-admin-main">
        <p role="status">Comprobando sesión…</p>
      </main>
    );
  return (
    <div className="smc-staff">
      <header className="cup-admin-header">
        <a href="/">
          <img
            src="/upload/logo.png"
            width="48"
            height="46"
            alt="Smoky Mountain Cup"
          />
        </a>
        <div>
          <strong>SMOKY MOUNTAIN CUP</strong>
          <small>Administración del torneo</small>
        </div>
        <a href="/">Ver sitio público</a>
        {user && <button onClick={() => void logout()}>Cerrar sesión</button>}
      </header>
      <main id="main-content" className="cup-admin-main">
        {message && (
          <p role="status" className="cup-message">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="cup-message error">
            {error}
          </p>
        )}
        {!user ? (
          <section className="cup-panel cup-login">
            <h1>Acceso del personal</h1>
            <ActionForm
              submit="Iniciar sesión"
              action={async (data) => {
                const r = await request<{ data: StaffUser }>(
                  'auth/login',
                  'POST',
                  {
                    email: text(data, 'email'),
                    password: text(data, 'password'),
                  },
                );
                setUser(r.data);
                setError('');
                setMessage('');
              }}
            >
              <label>
                Correo
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  maxLength={160}
                  required
                />
              </label>
              <label>
                Contraseña
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  maxLength={128}
                  required
                />
              </label>
            </ActionForm>
          </section>
        ) : (
          <>
            <div className="cup-toolbar">
              <p>
                {user.name} ·{' '}
                {user.role === 'admin' ? 'Administrador' : 'Anotador'}
              </p>
              {!user.mustChangePassword && (
                <button
                  className="cup-secondary"
                  onClick={() => {
                    setTab('password');
                    setMessage('');
                  }}
                >
                  Mi cuenta
                </button>
              )}
            </div>
            {user.mustChangePassword ? (
              <>
                <p className="cup-stale">
                  Debes cambiar tu contraseña inicial antes de continuar.
                </p>
                <PasswordForm
                  onChange={(u) => {
                    setUser(u);
                    setMessage('Contraseña actualizada.');
                  }}
                />
              </>
            ) : (
              <>
                {user.role === 'admin' && (
                  <nav className="cup-tabs" aria-label="Administración">
                    {(
                      [
                        ['seasons', 'Temporadas'],
                        ['teams', 'Equipos'],
                        ['players', 'Jugadores'],
                        ['venues', 'Sedes y canchas'],
                        ['organization', 'Organización'],
                        ['matches', 'Partidos'],
                        ['users', 'Usuarios'],
                        ['audit', 'Auditoría'],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        className={tab === key ? 'active' : ''}
                        onClick={() => {
                          setTab(key);
                          setMessage('');
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </nav>
                )}
                {tab === 'password' ? (
                  <PasswordForm
                    onChange={(u) => {
                      setUser(u);
                      setMessage(
                        'Contraseña actualizada. Las otras sesiones se cerraron.',
                      );
                    }}
                  />
                ) : user.role === 'scorer' ? (
                  <Matches user={user} revision={revision} refresh={refresh} />
                ) : tab === 'seasons' ? (
                  <Seasons revision={revision} refresh={refresh} />
                ) : tab === 'teams' ? (
                  <Teams revision={revision} refresh={refresh} />
                ) : tab === 'players' ? (
                  <Players revision={revision} refresh={refresh} />
                ) : tab === 'venues' ? (
                  <Venues revision={revision} refresh={refresh} />
                ) : tab === 'organization' ? (
                  <Organization
                    user={user}
                    revision={revision}
                    refresh={refresh}
                  />
                ) : tab === 'matches' ? (
                  <Matches user={user} revision={revision} refresh={refresh} />
                ) : tab === 'users' ? (
                  <Users revision={revision} refresh={refresh} current={user} />
                ) : (
                  <Audit revision={revision} />
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
