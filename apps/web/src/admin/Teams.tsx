import { request } from './api';
import {
  ActionButton,
  ActionForm,
  CollectionFooter,
  TextField,
  text,
  useCollection,
} from './components';
import type { Team } from './types';
export function Teams({
  revision,
  refresh,
}: {
  revision: number;
  refresh: () => void;
}) {
  const list = useCollection<Team>('teams', revision);
  return (
    <>
      <h1>Equipos</h1>
      <div className="cup-split">
        <section className="cup-panel">
          <h2>Crear equipo</h2>
          <p className="cup-muted">
            Se permiten nombres repetidos. Cada equipo conserva una identidad
            independiente.
          </p>
          <ActionForm
            action={(data) =>
              request('teams', 'POST', { name: text(data, 'name') })
            }
            onSuccess={refresh}
            submit="Crear equipo"
            reset
          >
            <TextField label="Nombre del equipo" name="name" />
          </ActionForm>
        </section>
        <section className="cup-panel">
          <h2>Equipos registrados</h2>
          {!list.loading && !list.data.length && (
            <p>No hay equipos registrados.</p>
          )}
          {list.data.map((t) => (
            <article key={t.id} className="smc-record">
              <h3>
                {t.name}
                {t.archived ? ' · Archivado' : ''}
              </h3>
              <p className="cup-muted">ID: {t.id}</p>
              {!t.archived && (
                <>
                  <details>
                    <summary>Editar {t.name}</summary>
                    <ActionForm
                      key={t.version}
                      action={(data) =>
                        request(`teams/${t.id}`, 'PATCH', {
                          expectedVersion: t.version,
                          name: text(data, 'name'),
                        })
                      }
                      onSuccess={refresh}
                    >
                      <TextField label="Nombre" name="name" initial={t.name} />
                    </ActionForm>
                  </details>
                  <ActionButton
                    action={() =>
                      request(`teams/${t.id}/archive`, 'POST', {
                        expectedVersion: t.version,
                      })
                    }
                    onSuccess={refresh}
                    confirm={`¿Archivar ${t.name}? Se conservarán sus inscripciones.`}
                  >
                    Archivar equipo
                  </ActionButton>
                </>
              )}
            </article>
          ))}
          <CollectionFooter list={list} />
        </section>
      </div>
    </>
  );
}
