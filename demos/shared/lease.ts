import type { Values } from '@fieldia/core';

/**
 * A flat let in Riyadh (`?page=lease`): a Saudi lease, whose days are shown and typed in the Hijri calendar beside the
 * Gregorian they keep, its first rent's month alone and the building's year alone; the tenant's national ID, IBAN and
 * car plate typed to their masks, and the one-time code the tenant confirms with. Invented people, places and numbers.
 */
export const LEASE: Values = {
  name: 'Olaya Tower, flat 1204 — one year',
  tenant: 'Faisal Al-Harbi',
  national_id: '1023456789',
  iban: 'SA0380000000608010167519',
  plate: null,
  confirm_code: null,
  unit: 'Olaya Tower, 12th floor, flat 1204',
  starts_on: '2026-10-13',
  ends_on: '2027-10-02',
  first_rent: null,
  built: '2014-01-01',
};
