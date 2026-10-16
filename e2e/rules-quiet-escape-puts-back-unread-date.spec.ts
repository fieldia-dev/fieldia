import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { open } from './support';

/**
 * Found by the 0.23 input-rules check (dates), MINOR. In the quiet look, Escape "puts back the value the field had as it
 * was entered" (viewer.ts) — but only when the field's value changed. A date typed that does not read ("31/02/2026",
 * "15/10/2026 14:3") never changes the value, so Escape leaves it in the box; left, it is kept unread with an error and
 * Save is refused — though the person pressed Escape to put the box back. A date that reads ("20/10/2026") is put back.
 */

const stateOf = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState() as { values: Record<string, unknown>; unread: Record<string, { text: string } | undefined> });

for (const [node, field, typed] of [
  ['f-start', 'start_date', '31/02/2026'],
  ['f-kickoff', 'kickoff', '15/10/2026 14:3'],
] as const) {
  test(`quiet: "${typed}" typed in ${node}, then Escape, puts the box back as it was entered — nothing left unread`, async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=fields&skin=quiet');
    const box = page.locator(`[data-node="${node}"] input.fd-input`);
    const before = (await stateOf(page)).values[field];
    await box.click();
    await box.press('Control+A');
    const entered = await box.inputValue();
    await box.pressSequentially(typed);
    await box.press('Escape');
    const afterEscape = await box.inputValue();
    await box.press('Tab');
    const after = await stateOf(page);
    expect({ afterEscape, unread: after.unread?.[field]?.text ?? null, value: after.values[field] }).toEqual({ afterEscape: entered, unread: null, value: before });
    expect(problems).toEqual([]);
  });
}
