import { saveRefused, type MemoryDataSource, type RecordPermissions, type SaveRequest, type Values, type WriteManyRequest } from '@fieldia/core';

/**
 * Three lists whose cells are changed in place (`editable`): a clinic's service prices, a front desk's staff hours this
 * week, and a sales pipeline's deal stages. The price list keeps versions, so a price someone else changes on another
 * screen meanwhile is said as a record's page says it (`priceListBar`); the staff hours' server refuses a week over 48
 * hours with why (`staffWeekRule`); the won stage is the sales manager's alone (`stagePermissions`).
 */

/** Who does a service. */
export const CLINIC_ROLES: Record<number, Values> = { 1: { name: 'Doctor' }, 2: { name: 'Nurse' }, 3: { name: 'Therapist' } };

const role = (id: number) => ({ id, label: String(CLINIC_ROLES[id]['name']) });

/** A clinic's services: what each is, who does it, how long it takes and what it costs. */
export function sampleServices(): Record<number, Values> {
  const rows: [string, string, number, number, number, boolean][] = [
    ['Botox, forehead', 'face', 1, 30, 4500, true],
    ['Botox, crow’s feet', 'face', 1, 20, 3500, true],
    ['Lip filler, 1 ml', 'face', 1, 45, 7800, true],
    ['Cheek filler, 2 ml', 'face', 1, 60, 14000, true],
    ['Chemical peel', 'skin', 3, 45, 2200, true],
    ['Hydrafacial', 'skin', 3, 60, 2800, true],
    ['Microneedling', 'skin', 2, 60, 3200, true],
    ['Skin consultation', 'skin', 1, 20, 600, true],
    ['Body contouring, one area', 'body', 3, 90, 6500, true],
    ['Lymphatic drainage', 'body', 3, 60, 1800, false],
    ['Laser, underarms', 'hair', 2, 15, 900, true],
    ['Laser, full legs', 'hair', 2, 60, 3400, true],
    ['Laser, face', 'hair', 2, 20, 1100, true],
  ];
  return Object.fromEntries(rows.map(([name, category, by, minutes, price, active], i) => [i + 1, { name, category, done_by: role(by), minutes, price, per_hour: Math.round((price / minutes) * 60), active }]));
}

/** The front desk's week: each person's hours by day, Saturday to Thursday. */
export function sampleStaffWeeks(): Record<number, Values> {
  const rows: [string, string, number[]][] = [
    ['Dr. Mona Adel', 'doctor', [8, 8, 0, 8, 8, 6]],
    ['Dr. Karim Samir', 'doctor', [0, 8, 8, 8, 8, 8]],
    ['Salma Hany', 'nurse', [8, 8, 8, 0, 8, 8]],
    ['Youssef Nabil', 'nurse', [6, 6, 6, 6, 6, 6]],
    ['Hana Wael', 'desk', [9, 9, 9, 9, 0, 9]],
    ['Omar Fathy', 'desk', [0, 4.5, 4.5, 4.5, 4.5, 4.5]],
  ];
  const days = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu'];
  return Object.fromEntries(rows.map(([name, as, hours], i) => [i + 1, { name, role: as, ...Object.fromEntries(days.map((day, d) => [day, hours[d]])), week: hours.reduce((sum, h) => sum + h, 0) }]));
}

/** A pipeline's stages, in their order: the won stage last. */
export function sampleStages(): Record<number, Values> {
  const rows: [string, number, number, string][] = [
    ['New', 0.1, 2, 'A lead that came in: called back the same day.'],
    ['Qualified', 0.25, 5, 'A budget, an area and a time to move named.'],
    ['Viewing', 0.4, 10, 'A viewing booked or done.'],
    ['Offer', 0.7, 14, 'An offer made in writing.'],
    ['Contract', 0.9, 21, 'A contract sent to sign.'],
    ['Won', 1, 0, 'Signed and paid the first instalment.'],
  ];
  return Object.fromEntries(rows.map(([name, probability, days, requirements], i) => [i + 1, { sequence: i + 1, name, probability, days, folded: false, won: name === 'Won', requirements }]));
}

/** The won stage is kept by the sales manager: everyone else reads it, and is told why. */
export function stagePermissions(values: Values): RecordPermissions | undefined {
  return values['won'] === true ? { edit: false, reason: 'The won stage is kept by the sales manager.' } : undefined;
}

/** The labour rules' week, as the clinic's server holds it: 48 hours at most. */
const MOST_HOURS = 48;
const DAYS = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu'];
const hoursOf = (values: Values) => DAYS.reduce((sum, day) => sum + (typeof values[day] === 'number' ? (values[day] as number) : 0), 0);
const hoursWords = (hours: number) => `${Math.floor(hours)}:${String(Math.round((hours % 1) * 60)).padStart(2, '0')}`;

/**
 * The staff hours' server rule: a week over 48 hours is refused with why, whichever way it is written — a row saved,
 * or several written at once — as the clinic's server would, after the page's own rules passed it.
 */
export function staffWeekRule(source: MemoryDataSource): void {
  const save = source.save.bind(source);
  const writeMany = source.writeMany.bind(source);
  const refusal = (id: unknown, changes: Values) => {
    const stored = (source.records['staff.week'] ?? {})[String(id)] ?? {};
    const week = hoursOf({ ...stored, ...changes });
    return week > MOST_HOURS ? `${String(stored['name'] ?? 'This person')} would work ${hoursWords(week)} hours this week: the labour rules allow ${MOST_HOURS}.` : null;
  };
  source.save = async (request: SaveRequest) => {
    const why = request.model === 'staff.week' ? refusal(request.id, request.changes.values) : null;
    if (why) throw saveRefused({ kind: 'rule', message: why });
    const saved = await save(request);
    if (request.model === 'staff.week') {
      const stored = source.records['staff.week'][String(saved.id)];
      stored['week'] = hoursOf(stored);
    }
    return saved;
  };
  source.writeMany = async (request: WriteManyRequest) => {
    if (request.model !== 'staff.week') return writeMany(request);
    const refused = request.ids.flatMap((id) => {
      const why = refusal(id, request.values);
      return why ? [{ id, message: why }] : [];
    });
    const answer = await writeMany({ ...request, ids: request.ids.filter((id) => !refused.some((one) => one.id === id)) });
    for (const id of request.ids) {
      const stored = source.records['staff.week'][String(id)];
      if (stored) stored['week'] = hoursOf(stored);
    }
    return { failed: [...refused, ...answer.failed] };
  };
}

/** A worked-out price per hour kept as the clinic's server keeps it: written again with each save of a service. */
export function servicePerHour(source: MemoryDataSource): void {
  const save = source.save.bind(source);
  const writeMany = source.writeMany.bind(source);
  const again = (id: unknown) => {
    const stored = (source.records['clinic.service'] ?? {})[String(id)];
    if (stored && typeof stored['price'] === 'number' && typeof stored['minutes'] === 'number' && stored['minutes'] > 0) stored['per_hour'] = Math.round((stored['price'] / stored['minutes']) * 60);
  };
  source.save = async (request: SaveRequest) => {
    const saved = await save(request);
    if (request.model === 'clinic.service') again(saved.id);
    return saved;
  };
  source.writeMany = async (request: WriteManyRequest) => {
    const answer = await writeMany(request);
    if (request.model === 'clinic.service') request.ids.forEach(again);
    return answer;
  };
}

/**
 * Over the price list: someone else, on another screen, changes a service's price — the one whose row is open here,
 * else the first — so saving it here meets their change, said under the row with Reload and Keep mine.
 */
export function priceListBar(source: MemoryDataSource): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'demo-bar demo-panel-bar demo-meanwhile-bar fd-theme';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'fd-button';
  button.textContent = 'Someone else changes a price';
  const said = document.createElement('span');
  said.className = 'demo-meanwhile-said';
  said.setAttribute('role', 'status');
  said.textContent = 'Mona Adel may be changing this price list on another screen right now.';
  bar.append(button, said);
  button.addEventListener('click', () => {
    // The row being changed here, else the first row shown.
    const row = document.querySelector<HTMLElement>('.fd-list-row[data-changed][data-id], .fd-list-row:has(td[data-editing])[data-id]') ?? document.querySelector<HTMLElement>('.fd-list-row[data-id]');
    const id = row?.dataset['id'];
    const stored = id ? source.records['clinic.service']?.[id] : undefined;
    if (!id || !stored) return;
    const price = Math.round((Number(stored['price']) * 1.1) / 50) * 50;
    source.changeElsewhere('clinic.service', id, { price, per_hour: Math.round((price / Number(stored['minutes'])) * 60) }, { by: 'Mona Adel' });
    said.textContent = `Mona Adel changed ${String(stored['name'])} to EGP ${price.toLocaleString('en')} on another screen. Change its row here and leave it: this page says so, and saves nothing over hers until you choose.`;
  });
  return bar;
}
