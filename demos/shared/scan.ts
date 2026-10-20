import type { Page, Values } from '@fieldia/core';
import clinicTreatment from '../../examples/pages/clinic-treatment.page.json';
import stockCount from '../../examples/pages/stock-count.page.json';

/**
 * Codes scanned with the camera (`options.scan`): a clinic's treatment, its patient found by the QR code on her card and
 * each injectable's product, lot and expiry read from the GS1 DataMatrix on its box; and a shelf's stock counted by its
 * barcodes. The codes to hold up to the camera are demos/samples/codes-to-scan.html (tools/scan-codes.mjs makes it from
 * the records below).
 */
export const treatmentPage = clinicTreatment as Page;
export const stockCountPage = stockCount as Page;

/** The clinic's patients, each with the code on their card. */
export const PATIENTS: Record<number, Values> = {
  1: { name: 'Mona Adel', card: 'P-1042' },
  2: { name: 'Hana Fouad', card: 'P-1043' },
  3: { name: 'Salma Nabil', card: 'P-1044' },
};

/** The injectables the clinic keeps, by their GTIN; and a box of each, as its DataMatrix holds it. */
export const INJECTABLES: Record<number, Values & { box: { lot: string; expiry: string; serial: string } }> = {
  1: { name: 'Botulinum toxin type A, 100 U', gtin: '06285096000842', box: { lot: '25A1234', expiry: '281231', serial: 'SN000417' } },
  2: { name: 'Hyaluronic acid filler 1 ml', gtin: '07612345000015', box: { lot: 'HF-2207', expiry: '270630', serial: 'SN118204' } },
  3: { name: 'Lidocaine 2% 5 ml', gtin: '06221025001238', box: { lot: 'LD5521', expiry: '271100', serial: 'SN550903' } },
};

/** The shop's products on the shelf counted, by their barcodes (EAN-13). */
export const SHELF: Record<number, Values> = {
  1: { name: 'Hand cream 50 ml', barcode: '6224000123451' },
  2: { name: 'Lip balm', barcode: '6224000123468' },
  3: { name: 'Sunscreen SPF 50', barcode: '6224000123475' },
  4: { name: 'Face wash 150 ml', barcode: '6224000123482' },
};

/** The records the demos open: a treatment with a line scanned already, and a shelf being counted. */
export function scanRecords(): Record<string, Record<number, Values>> {
  return {
    'clinic.patient': PATIENTS,
    'clinic.product': Object.fromEntries(Object.entries(INJECTABLES).map(([id, { name, gtin }]) => [id, { name, gtin }])),
    'clinic.treatment': {
      1: {
        patient_id: { id: 1, label: 'Mona Adel' },
        treated_on: '2026-10-20',
        doctor: 'Dr. Karim Hassan',
        line_ids: [{ key: 'l1', id: 1, values: { product_id: { id: 1, label: 'Botulinum toxin type A, 100 U' }, lot: '25A1234', expiry: '2028-12-31', units: 20 } }],
        notes: 'Forehead and crow’s feet. Review in two weeks.',
      },
    },
    'stock.product': SHELF,
    'stock.count': {
      1: { location: 'Shelf B2, skin care', counted_on: '2026-10-20', counted_by: 'Mona Adel', line_ids: [{ key: 'c1', id: 1, values: { product_id: { id: 2, label: 'Lip balm' }, counted: 3 } }] },
    },
  };
}
