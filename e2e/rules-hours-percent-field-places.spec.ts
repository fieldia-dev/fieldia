import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open } from './support';

/**
 * Found by the 0.23 input-rules check (number boxes). The hours box and the per cent box keep what is typed as another
 * number — hours and minutes as hours (6:20 is 6.3333…), a per cent as a fraction (12.5 is 0.125) — and check (core
 * check.ts) then counts the places of that number against the field's `digits`:
 *
 * - BLOCKING by its effect: Flectra's task keeps its Allocated Time with digits [16, 2] in an hours box (the "real-task"
 *   page). "6:20", "1:10", "0:05" — any minutes but a multiple of 3 — are refused under the box with "Allocated Time
 *   takes at most 2 decimal places", and Ctrl+Enter and Save do not save. Nothing typed has a decimal place; there is
 *   no way to write 6 h 20 that this form takes. (Flectra rounds the hours to the field's places as it stores them.)
 * - The same for a per cent of a field with digits [5, 2]: the box takes two places of the per cent (`percentPlaces`),
 *   so "12.5" lands and reads as 0.125, which check refuses: "Cut takes at most 2 decimal places".
 */

const formState = (page: Page) =>
  page.evaluate(() => {
    const s = (window as any).fieldiaDemo.handle.form.getState();
    return { values: s.values as Record<string, number | null>, errors: s.errors as Record<string, string>, status: s.status as string };
  });

test.describe('hours and a per cent in a field with digits', () => {
  let problems: string[] = [];
  test.afterEach(() => expect(problems).toEqual([]));

  test('real task: Allocated Time typed "6:20" is taken and saved by Ctrl+Enter, never refused for decimal places', async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=real-task&record=5201&skin=underline'));
    const stored = () => page.evaluate(() => (window as any).fieldiaDemo.dataSource.records['project.task'][5201].allocated_hours as number);
    const box = node(page, 'f-allocated').locator('input').first();
    await box.click();
    await box.press('Control+A');
    await box.pressSequentially('6:20');
    await page.keyboard.press('Tab');
    expect((await formState(page)).errors['allocated_hours'] ?? null).toBeNull();
    await box.click();
    await box.press('Control+Enter');
    // Six hours and twenty minutes, to the minute, whatever places the record keeps it with.
    await expect.poll(async () => Math.round((await stored()) * 60)).toBe(380);
  });

  test('a page of its own: "12.5" % in a field of two places and "1:10" hours are taken, with no words against them', async ({ page }) => {
    ({ problems } = await open(page, 'script', ''));
    await page.evaluate(async () => {
      const fieldia = (window as any).Fieldia;
      const demo = (window as any).fieldiaDemo;
      const shown = {
        fieldia: '0.4',
        id: 'places',
        title: 'Places',
        data: { kind: 'responses' },
        fields: { cut: { type: 'float', label: 'Cut', digits: [5, 2] }, hours: { type: 'float', label: 'Hours', digits: [16, 2] } },
        layout: { type: 'sections', id: 'root', children: [
          { type: 'field', id: 'f-cut', field: 'cut', widget: 'percentage' },
          { type: 'field', id: 'f-hours', field: 'hours', widget: 'duration' },
        ] },
      };
      demo.handle.destroy();
      demo.handle = fieldia.mountViewer(document.getElementById('app'), { page: shown, dataSource: fieldia.createMemoryDataSource() });
      await demo.handle.drawn;
    });
    for (const [id, typed] of [
      ['f-cut', '12.5'],
      ['f-hours', '1:10'],
    ] as const) {
      const box = node(page, id).locator('input').first();
      await box.click();
      await box.press('Control+A');
      await box.pressSequentially(typed);
      await page.keyboard.press('Tab');
    }
    const now = await formState(page);
    expect(now.errors).toEqual({});
    expect({ cut: now.values['cut'], minutes: Math.round((now.values['hours'] ?? 0) * 60) }).toEqual({ cut: 0.125, minutes: 70 });
  });
});
