// Meetup times are shown in Harlem time, wherever the viewer is.
const HARLEM = 'America/New_York';
const dayFmt = new Intl.DateTimeFormat('en-US', { timeZone: HARLEM, weekday: 'short', month: 'short', day: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('en-US', { timeZone: HARLEM, hour: 'numeric', minute: '2-digit' });

/** "Sat, Nov 7, 12:00 PM to 2:00 PM" from a meetup's startsAt / endsAt (ISO instants). */
export const meetupWhen = (m) =>
  `${dayFmt.format(new Date(m.startsAt))}, ${timeFmt.format(new Date(m.startsAt))} to ${timeFmt.format(new Date(m.endsAt))}`;

/** "2026-11-07T12:00" in Harlem time, for a datetime-local input. */
export const toHarlemInput = (iso) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: HARLEM, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
};
