import type { Values } from '@fieldia/core';

/**
 * A flat let in Riyadh (`?page=lease`): a Saudi lease, whose days are shown and typed in the Hijri calendar beside the
 * Gregorian they keep, its first rent's month alone and the building's year alone; the tenant's national ID, IBAN and
 * car plate typed to their masks, and the one-time code the tenant confirms with. Invented people, places and numbers.
 */
/** The office's agents, as a link's list shows them: each one's role under the name, a colour, the leases held now. */
export const LEASE_AGENTS: Record<number, Values> = {
  1: { name: 'Noura Al-Qahtani', role: 'Senior leasing agent', tone: 7, holding: '12 leases' },
  2: { name: 'Omar Al-Shehri', role: 'Leasing agent, Olaya', tone: 4, holding: '8 leases' },
  3: { name: 'Huda Al-Mutairi', role: 'Property manager', tone: 10, holding: '31 units' },
  4: { name: 'Saad Al-Dossary', role: 'Leasing agent, Malqa', tone: 2, holding: '5 leases' },
};
/** What a link to an agent shows besides the name (the memory source's `shows`). */
export const LEASE_SHOWS = { 'lease.agent': { details: ['role'], color: 'tone', aside: 'holding' } };

export const LEASE: Values = {
  name: 'Olaya Tower, flat 1204 — one year',
  tenant: 'Faisal Al-Harbi',
  national_id: '1023456789',
  iban: 'SA0380000000608010167519',
  plate: null,
  confirm_code: null,
  unit: 'Olaya Tower, 12th floor, flat 1204',
  agent_id: { id: 2, label: 'Omar Al-Shehri' },
  starts_on: '2026-10-13',
  ends_on: '2027-10-02',
  rent: 96000,
  plan: 'twice',
  first_rent: null,
  built: '2014-01-01',
};
