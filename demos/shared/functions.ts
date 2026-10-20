import type { AppFunctions } from '@fieldia/core';

/**
 * The demos' own function, as an app gives its own to a page's formulas (`functions`): the district's average price
 * per square metre, asked of the app's server — here a stand-in that answers after a moment, as a server would. A
 * listing's comparison with it waits for the answer, and saving waits too (examples/pages/listing.page.json).
 */

/** Recent sales, per square metre, by district: what the app's server would read. */
const AVERAGES: Record<string, number> = { new_cairo: 52000, sheikh_zayed: 47500, maadi: 61000, zamalek: 98000 };

/** How long the stand-in server takes to answer, in milliseconds. */
export const SERVER_MS = 900;

export const demoFunctions: AppFunctions = {
  districtPrice: {
    takes: [1, 1],
    values: ['text'],
    gives: 'number',
    asks: true,
    tip: 'The district’s average price per m², from recent sales: districtPrice(district)',
    call: (district: string | null) => new Promise<number | null>((answer) => setTimeout(() => answer(district ? (AVERAGES[district] ?? null) : null), SERVER_MS)),
  },
};
