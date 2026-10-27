import type { DemoReplay } from '../hand';

/** The visit-feedback demo’s how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Tick Botox and Chemical peel: “Which would you have again?”',
      async run({ page, press, see }) {
        const had = page.getByRole('group', { name: 'Which treatments did you have?', exact: true });
        await press(had.getByRole('checkbox', { name: 'Botox' }));
        await press(had.getByRole('checkbox', { name: 'Chemical peel' }));
        const again = page.locator('[data-node="f-again"]');
        const next = page.locator('[data-node="f-try-next"]');
        await see(again).toContainText('Which would you have again?');
        await see(again.locator('label.fd-choice')).toHaveText(['Botox', 'Chemical peel', 'None of them']);
        await see(next).toContainText('Which would you like to try next time?');
        await see(next.locator('label.fd-choice')).toHaveText(['Filler', 'Laser hair removal', 'HydraFacial']);
      },
    },
    {
      says: 'Pick Chemical peel to have again, then untick it above',
      async run({ page, press, see }) {
        const again = page.locator('[data-node="f-again"]');
        await press(again.getByRole('radio', { name: 'Chemical peel' }));
        await see(again.getByRole('radio', { name: 'Chemical peel' })).toBeChecked();
        await press(page.getByRole('group', { name: 'Which treatments did you have?', exact: true }).getByRole('checkbox', { name: 'Chemical peel' }));
        await see(again.locator('label.fd-choice')).toHaveText(['Botox', 'None of them']);
        await see(again.locator(':scope > .fd-warning')).toHaveText('Chemical peel is no longer offered, so it was taken out');
        await see(page.locator('[data-node="f-try-next"] label.fd-choice')).toHaveText(['Filler', 'Chemical peel', 'Laser hair removal', 'HydraFacial']);
      },
    },
    {
      says: 'Type a date of birth: your age shows',
      async run({ page, type, keys, see }) {
        const birth = page.getByRole('textbox', { name: 'Your date of birth' });
        const age = page.locator('[data-node="f-age-now"] input');
        const tell = page.getByRole('group', { name: 'May we tell you about…' });
        // An adult: the age on today's clock, the adults' laser packages offered.
        const now = new Date();
        const years = (y: number, m: number, d: number) => now.getFullYear() - y - (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d) ? 1 : 0);
        await type(birth, '04/03/1990');
        await keys('Tab');
        await see(age).toHaveValue(String(years(1990, 3, 4)));
        await see(tell.getByRole('checkbox', { name: 'Laser packages for adults' })).toBeVisible();
        // Under 18: not offered.
        await type(birth, '04/03/2012', { clear: true });
        await keys('Tab');
        await see(age).toHaveValue(String(years(2012, 3, 4)));
        await see(tell.getByRole('checkbox', { name: 'Laser packages for adults' })).toHaveCount(0);
      },
    },
    {
      says: 'Tick None of these: “Which would you have again?” goes',
      async run({ page, press, see }) {
        const tell = page.getByRole('group', { name: 'May we tell you about…' });
        await see(tell.getByRole('checkbox', { name: 'Offers on what you had' })).toBeVisible();
        await press(page.getByRole('group', { name: 'Which treatments did you have?', exact: true }).getByRole('checkbox', { name: 'None of these' }));
        await see(page.getByRole('checkbox', { name: 'Botox' }).first()).not.toBeChecked();
        await see(page.locator('[data-node="f-again"]')).toBeHidden();
        await see(tell.getByRole('checkbox', { name: 'Offers on what you had' })).toHaveCount(0);
        // Nothing had: every treatment to try next time.
        await see(page.locator('[data-node="f-try-next"] label.fd-choice')).toHaveText(['Botox', 'Filler', 'Chemical peel', 'Laser hair removal', 'HydraFacial']);
        await see(tell.getByRole('checkbox', { name: 'The clinic’s news' })).toBeVisible();
      },
    },
  ],
};
