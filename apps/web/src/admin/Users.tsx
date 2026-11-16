import { request } from './api';
import {
  ActionForm,
  CollectionFooter,
  TextField,
  text,
  useCollection,
} from './components';
import type { StaffUser } from './types';
export function Users({
  revision,
  refresh,
  current,
}: {
  revision: number;
  refresh: () => void;
  current: StaffUser;
}) {
  const list = useCollection<StaffUser>('users', revision);
  return (
    <>
      <h1>Usuarios del personal</h1>
      <div className="cup-split">
        <section className="cup-panel">
          <h2>Crear usuario</h2>
          <p className="cup-muted">
            Entrega la contraseña inicial por un canal privado. Se exigirá
            cambiarla al iniciar sesión.
          </p>
          <ActionForm
            reset
            submit="Crear usuario"
            action={(data) =>
              request('users', 'POST', {
                name: text(data, 'name'),
                email: text(data, 'email'),
                password: text(data, 'password'),
                role: text(data, 'role'),
              })
            }
            onSuccess={refresh}
          >
            <TextField label="Nombre" name="name" />
            <TextField
              label="Correo"
              name="email"
              type="email"
              maxLength={160}
            />
            <label>
              Rol
              <select name="role" defaultValue="scorer">
                <option value="scorer">Anotador</option>
                <option value="admin">Administrador</option>
              </select>
            </label>
            <TextField
              label="Contraseña inicial"
              name="password"
              type="password"
              minLength={12}
              maxLength={128}
            />
          </ActionForm>
        </section>
        <section className="cup-panel">
          <h2>Personal registrado</h2>
          {list.data.map((u) => (
            <article key={u.id} className="smc-record">
              <h3>
                {u.name}
                {u.id === current.id ? ' · Tu cuenta' : ''}
              </h3>
              <p>
                {u.email} · {u.role === 'admin' ? 'Administrador' : 'Anotador'}{' '}
                · {u.active ? 'Activo' : 'Inactivo'}
              </p>
              {u.mustChangePassword && (
                <p className="cup-muted">Cambio de contraseña pendiente.</p>
              )}
              <details>
                <summary>Editar {u.name}</summary>
                <ActionForm
                  key={u.version}
                  action={(data) =>
                    request(`users/${u.id}`, 'PATCH', {
                      expectedVersion: u.version,
                      name: text(data, 'name'),
                      email: text(data, 'email'),
                      role: text(data, 'role'),
                      active: data.get('active') === 'on',
                    })
                  }
                  onSuccess={refresh}
                >
                  <TextField label="Nombre" name="name" initial={u.name} />
                  <TextField
                    label="Correo"
                    name="email"
                    type="email"
                    initial={u.email}
                    maxLength={160}
                  />
                  <label>
                    Rol
                    <select name="role" defaultValue={u.role}>
                      <option value="scorer">Anotador</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      name="active"
                      defaultChecked={u.active}
                    />{' '}
                    Usuario activo
                  </label>
                  <p className="cup-muted">
                    Los cambios cerrarán las sesiones de esta cuenta.
                  </p>
                </ActionForm>
              </details>
              {u.id !== current.id && (
                <details>
                  <summary>Restablecer contraseña de {u.name}</summary>
                  <ActionForm
                    submit="Restablecer contraseña"
                    reset
                    action={(data) =>
                      request(`users/${u.id}/reset-password`, 'POST', {
                        expectedVersion: u.version,
                        password: text(data, 'password'),
                      })
                    }
                    onSuccess={refresh}
                  >
                    <TextField
                      label="Nueva contraseña temporal"
                      name="password"
                      type="password"
                      minLength={12}
                      maxLength={128}
                    />
                    <p className="cup-muted">
                      Cerrará sus sesiones y exigirá un cambio al volver a
                      entrar.
                    </p>
                  </ActionForm>
                </details>
              )}
            </article>
          ))}
          <CollectionFooter list={list} />
        </section>
      </div>
    </>
  );
}
