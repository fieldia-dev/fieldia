import { expect, test } from './fixtures';
import { open } from './support';
import { fieldia } from '../libs/testing/src/playwright';

/**
 * @fieldia/testing's Playwright helpers on the workshop sign-up, as an app's own tests would use them — in every engine
 * (playwright.config.ts's smoke set): fields by their labels' words, a list, radios and a switch picked and ticked, a
 * button pressed by its words, a field's problems and its box read back.
 */
test('the testing kit fills, picks, ticks and presses by the words people read, and reads back what they see', async ({ page }) => {
  await open(page, 'plain', 'page=signup&skin=outlined');
  const form = fieldia(page);
  expect(await form.labels()).toEqual(expect.arrayContaining(['Full name', 'Email', 'Your role', 'Experience with form builders', 'Joining the dinner']));
  // Nothing filled in: Submit says what is missing, on each field.
  await form.press('Submit');
  await expect(await form.error('Full name')).toBeVisible();
  expect((await form.errorsOf('Email')).length).toBe(1);

  await form.fill('Full name', 'Mona Adel');
  await form.fill('Email', 'mona@');
  await expect.poll(() => form.errorsOf('Email')).toEqual(['Enter an email address, like name@example.com']);
  await form.fill('Email', 'mona@example.com');
  await expect.poll(() => form.errorsOf('Email')).toEqual([]);
  await form.pick('Your role', 'Manager');
  // A field the role brings out, found once it shows.
  await form.fill('People in your team', '12');
  await form.pick('Experience with form builders', 'Some');
  await form.check('Joining the dinner');
  await form.fill('Dietary needs', 'Vegetarian');

  expect(await form.valueOf('Full name')).toBe('Mona Adel');
  expect(await form.valueOf('Your role')).toBe('Manager');
  expect(await form.valueOf('Experience with form builders')).toBe('Some');
  expect(await form.valueOf('Joining the dinner')).toBe(true);
  expect(await form.read('Email')).toEqual({ label: 'Email', value: 'mona@example.com', errors: [], warnings: [] });
  await form.check('Joining the dinner', false);
  expect(await form.valueOf('Joining the dinner')).toBe(false);
  // A label no field has, said with the ones there are.
  await expect(form.field('Fax')).rejects.toThrow(/No field labelled “Fax”\. The fields shown: Full name, Email/);
  // By its field's name too.
  await expect(await form.field({ field: 'company' })).toBeVisible();
});
