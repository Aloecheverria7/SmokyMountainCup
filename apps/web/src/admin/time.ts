import { DateTime } from 'luxon';
export function scheduleOptions(local: string, zone: string) {
  if (!local) return [];
  const date = DateTime.fromISO(local, { zone });
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local) ||
    !date.isValid ||
    date.toFormat("yyyy-MM-dd'T'HH:mm") !== local
  )
    throw Error('Esa hora no existe en la zona del torneo. Elige otra hora.');
  return date.getPossibleOffsets().map((d) => ({
    value: d.toUTC().toISO()!,
    label: d.toFormat("HH:mm 'UTC'ZZ"),
  }));
}
