import type { FileValue, Page, Values } from '@fieldia/core';
import clinicConsent from '../../examples/pages/clinic-consent.page.json';

/**
 * A clinic's consent to treatment, signed (its signature's `options.signs`): the patient's answers, their signature,
 * and beside it who signed, when, and the fingerprint of the answers signed (`FileValue.signed`). Two kept already: Mona
 * Adel's, as she signed it; and Hana Fouad's, whose areas were changed in the clinic's system after she signed — the
 * page says so. The fingerprints are the answers' own, as the files part works them out (signature-evidence.ts).
 */
export const consentPage = clinicConsent as Page;

/** A signature drawn, as its picture: a hand's strokes, blue-black on clear. */
const drawn = (strokes: string): FileValue => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 180"><path fill="none" stroke="#1b2a5c" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" d="${strokes}"/></svg>`;
  return { name: 'signature.svg', type: 'image/svg+xml', size: svg.length, data: btoa(svg) };
};

const SIGNED = ['patient', 'birth_date', 'treatment', 'areas', 'pregnant', 'allergies', 'risks_read', 'photos'];

/** The consents kept, by id. */
export function sampleConsents(): Record<string, Values> {
  return {
    1: {
      patient: 'Mona Adel',
      birth_date: '1991-04-12',
      treatment: 'botox',
      areas: ['forehead', 'crows_feet'],
      pregnant: false,
      allergies: 'None',
      risks_read: true,
      photos: true,
      doctor_notes: 'Two units round each eye. Review in two weeks.',
      signature: {
        ...drawn(
          'M62 128c10-38 22-74 30-76 8-2-6 70 0 72 7 2 22-74 30-72 8 2 0 62 8 64 9 2 18-30 30-32 12-2 12 26 2 30-10 4-14-16 0-24 14-8 22 22 32 20 10-2 10-30 20-30 9 0 6 30 16 30 12 0 18-26 28-26 10 0 8 24 18 22M300 126c14-46 30-84 40-84 9 0 4 60 10 82M318 98c22-6 40-6 58-2M392 92c-14-4-26 10-24 24 2 16 22 12 30-6 6-16 4-50 8-60 4 26 2 58 12 64 10 6 20-26 34-26 12 0 10 20-4 24-12 4-14-12 2-20 12-6 26 12 34 18 10 6 18-40 26-62 4 18-2 52 6 62 6 8 20 2 30-8'
        ),
        signed: { format: 'fieldia-signature/1', by: 'Mona Adel', at: '2026-10-14T07:42:00.000Z', fields: SIGNED, sha256: '3667c9d2ee8f42a370ffc70a2a72bb17c7d0e47f913fe6af6c8c35e101d7697e' },
      },
    },
    2: {
      patient: 'Hana Fouad',
      birth_date: '1987-09-30',
      treatment: 'filler',
      // She signed for her lips alone; Cheeks was added in the clinic's system afterwards.
      areas: ['lips', 'cheeks'],
      pregnant: false,
      allergies: 'Penicillin',
      risks_read: true,
      photos: false,
      doctor_notes: '',
      signature: {
        ...drawn(
          'M70 130c8-30 16-70 22-90 2 40-4 70-2 90M76 92c18-4 34-4 46 0M128 60c-4 30-8 52-6 70 6-22 14-36 24-36 10 0 6 30 14 30 10 0 16-26 26-26 9 0 6 26 14 26 10 0 14-22 24-22 10 0 8 22 16 22M300 130c6-30 12-62 18-86 18-2 34-2 48 2M310 90c14-2 28-2 38 0M372 104c-12 0-18 22-6 24 12 2 20-20 16-28-2 12 4 26 14 24 10-2 14-22 22-22 6 0 4 20 10 20 8 0 12-18 20-18 6 6 0 20 8 20 10 0 14-20 22-24-14 0-20 24-8 26 12 2 18-26 22-60 2 20 0 46 6 60'
        ),
        signed: { format: 'fieldia-signature/1', by: 'Hana Fouad', at: '2026-10-16T12:05:00.000Z', fields: SIGNED, sha256: 'd8df437430c7da7fded211a0668bf686fac0593039c21d8d1eac97a236bde7f0' },
      },
    },
  };
}
