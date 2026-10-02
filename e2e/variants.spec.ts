import { expect, test } from '@playwright/test';
import { EXPECTED_VARIANTS, VARIANTS } from './variants';

test('every framework demo was built, so no gate is skipped', () => {
  expect(VARIANTS).toEqual(EXPECTED_VARIANTS);
});
