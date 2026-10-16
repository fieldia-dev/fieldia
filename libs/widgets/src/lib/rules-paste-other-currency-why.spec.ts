import type { LineField } from '@fieldia/core';
import { WIDGET_LABELS } from '@fieldia/widgets';
import { whyNotPasted } from './cell-paste';

/**
 * An amount in another currency pasted into a money column: "$5" into an Unit price in E£. It is not pasted (right),
 * and the note names why — "Unit price: “$5” is not a number" (seen on the order demo's grid). The input rules §2:
 * a cell not pasted is named "with why (as its box says it)", and the money box says it of the same paste: "Unit
 * price is in EGP, and this amount is in $" (input-rules.ts, `otherCurrency`). "$5" is a number; the why is wrong.
 */

it('a money cell names another currency as its box does, never “is not a number”', () => {
  const price = { type: 'monetary', label: 'Unit price', currency: 'EGP' } as LineField;
  const why = whyNotPasted(price, '$5', { locale: 'en', currency: 'EGP', labels: WIDGET_LABELS.en });
  expect(why).not.toContain('is not a number');
  expect(why).toBe('Unit price is in EGP, and this amount is in $');
});
