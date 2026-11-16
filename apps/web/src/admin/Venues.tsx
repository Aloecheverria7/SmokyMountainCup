import { request } from './api';
import {
  ActionButton,
  ActionForm,
  CollectionFooter,
  TextField,
  text,
  useCollection,
} from './components';
interface Venue {
  id: string;
  name: string;
  address: string;
  archived: boolean;
  version: number;
}
export interface Field {
  id: string;
  name: string;
  venue: string;
  venueId: string;
  archived: boolean;
  venueArchived: boolean;
  version: number;
}
export function Venues({
  revision,
  refresh,
}: {
  revision: number;
  refresh: () => void;
}) {
  const venues = useCollection<Venue>('venues', revision),
    fields = useCollection<Field>('fields', revision);
  return (
    <>
      <h1>Sedes y canchas</h1>
      <div className="cup-split">
        <section className="cup-panel">
          <h2>Nueva sede</h2>
          <ActionForm
            reset
            action={(d) =>
              request('venues', 'POST', {
                name: text(d, 'name'),
                address: text(d, 'address'),
              })
            }
            onSuccess={refresh}
            submit="Crear sede"
          >
            <TextField label="Nombre de la sede" name="name" />
            <TextField
              label="Dirección"
              name="address"
              maxLength={255}
              required={false}
            />
          </ActionForm>
          <h2>Nueva cancha</h2>
          <ActionForm
            reset
            action={(d) =>
              request('fields', 'POST', {
                name: text(d, 'name'),
                venueId: text(d, 'venueId'),
              })
            }
            onSuccess={refresh}
            submit="Crear cancha"
          >
            <label>
              Sede
              <select name="venueId" required defaultValue="">
                <option value="" disabled>
                  Selecciona una sede
                </option>
                {venues.data
                  .filter((v) => !v.archived)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
              </select>
            </label>
            <TextField label="Nombre de la cancha" name="name" />
          </ActionForm>
        </section>
        <section className="cup-panel">
          <h2>Sedes registradas</h2>
          {venues.data.map((v) => (
            <article key={v.id} className="smc-record">
              <h3>
                {v.name}
                {v.archived ? ' · Archivada' : ''}
              </h3>
              <p>{v.address}</p>
              {!v.archived && (
                <>
                  <details>
                    <summary>Editar {v.name}</summary>
                    <ActionForm
                      action={(d) =>
                        request(`venues/${v.id}`, 'PATCH', {
                          expectedVersion: v.version,
                          name: text(d, 'name'),
                          address: text(d, 'address'),
                        })
                      }
                      onSuccess={refresh}
                    >
                      <TextField label="Nombre" name="name" initial={v.name} />
                      <TextField
                        label="Dirección"
                        name="address"
                        initial={v.address}
                        maxLength={255}
                        required={false}
                      />
                    </ActionForm>
                  </details>
                  <ActionButton
                    action={() =>
                      request(`venues/${v.id}/archive`, 'POST', {
                        expectedVersion: v.version,
                      })
                    }
                    onSuccess={refresh}
                    confirm={`¿Archivar la sede ${v.name}?`}
                  >
                    Archivar sede
                  </ActionButton>
                </>
              )}
            </article>
          ))}
          <CollectionFooter list={venues} />
          <h2>Canchas registradas</h2>
          {fields.data.map((f) => (
            <article key={f.id} className="smc-record">
              <h3>
                {f.name} · {f.venue}
              </h3>
              {f.archived || f.venueArchived ? (
                <p>Archivada o sede no disponible.</p>
              ) : (
                <>
                  <details>
                    <summary>Editar cancha {f.name}</summary>
                    <ActionForm
                      action={(d) =>
                        request(`fields/${f.id}`, 'PATCH', {
                          expectedVersion: f.version,
                          name: text(d, 'name'),
                        })
                      }
                      onSuccess={refresh}
                    >
                      <TextField label="Nombre" name="name" initial={f.name} />
                    </ActionForm>
                  </details>
                  <ActionButton
                    action={() =>
                      request(`fields/${f.id}/archive`, 'POST', {
                        expectedVersion: f.version,
                      })
                    }
                    onSuccess={refresh}
                    confirm={`¿Archivar la cancha ${f.name}?`}
                  >
                    Archivar cancha
                  </ActionButton>
                </>
              )}
            </article>
          ))}
          <CollectionFooter list={fields} />
        </section>
      </div>
    </>
  );
}
