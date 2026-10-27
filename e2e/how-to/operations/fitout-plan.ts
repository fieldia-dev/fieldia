import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';

/** The fitout-plan demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Drag a bar to another day: it is saved at once, its arrows follow it',
      notOnPhone: 'a drag: Playwright’s WebKit has no touch drag',
      async run({ page, press, drag, see, demo }) {
        const saved = async () => (await demo<Record<string, Record<number, { start: string }>>>('dataSource.records'))['cafe.task'][12].start;
        const start = await saved();
        const painting = page.locator('.fd-gantt-task[data-id="12"]');
        const said = page.locator('.fd-gantt-said');
        await see(painting).toHaveText('Painting');
        await painting.scrollIntoViewIfNeeded();
        const before = (await painting.boundingBox())!;
        const arrows = page.locator('.fd-gantt-link[data-to="12"], .fd-gantt-link[data-from="12"]');
        const drawn = () => arrows.evaluateAll((all) => all.map((arrow) => arrow.getAttribute('d')));
        const was = await drawn();
        expect(was.length).toBeGreaterThan(0);
        // Two days on (a day is forty pixels), let go a little past.
        await drag(painting, { x: before.x + before.width / 2 + 86, y: before.y + before.height / 2 });
        await see(said).toContainText(/^Moved Painting: /);
        await expect.poll(async () => Math.round((await painting.boundingBox())!.x - before.x)).toBe(80);
        // Saved at once: the app's record has its new start.
        await expect.poll(saved).not.toBe(start);
        // Its arrows with it.
        await expect.poll(drawn).not.toEqual(was);
        // Undo: as it was.
        await press(said.getByRole('button', { name: 'Undo' }));
        await see(said).toHaveText(/Put back as it was\./);
        await expect.poll(async () => Math.round((await painting.boundingBox())!.x - before.x)).toBe(0);
        await expect.poll(drawn).toEqual(was);
        await expect.poll(saved).toBe(start);
        await see(painting).toBeVisible();
      },
    },
    {
      says: 'Drag the end of a bar: the task takes more days, or fewer',
      notOnPhone: 'a drag: Playwright’s WebKit has no touch drag',
      async run({ page, drag, see }) {
        const flooring = page.locator('.fd-gantt-task[data-id="13"]');
        const said = page.locator('.fd-gantt-said');
        await see(flooring).toHaveAttribute('aria-label', /, 4 days, /);
        await flooring.scrollIntoViewIfNeeded();
        const end = flooring.locator('.fd-gantt-grip[data-edge="end"]');
        const box = (await end.boundingBox())!;
        // A day more.
        await drag(end, { x: box.x + box.width / 2 + 40, y: box.y + box.height / 2 });
        await see(said).toContainText(/^Flooring now ends /);
        await see(flooring).toHaveAttribute('aria-label', /, 5 days, /);
        // Two fewer.
        const wider = (await end.boundingBox())!;
        await drag(end, { x: wider.x + wider.width / 2 - 80, y: wider.y + wider.height / 2 });
        await see(flooring).toHaveAttribute('aria-label', /, 3 days, /);
      },
    },
    {
      says: 'Without a mouse: Tab to a bar, then the left and right arrows move',
      notOnPhone: 'a phone has no Tab or arrow keys',
      async run({ page, press, keys, see }) {
        const said = page.locator('.fd-gantt-said');
        const focused = page.locator(':focus');
        // From Today, Tab after Tab: the three scales, the first phase's heading, then the timeline's one stop, a bar.
        await press(page.getByRole('group', { name: 'Timeline' }).getByRole('button', { name: 'Today' }));
        const onABar = () => page.evaluate(() => document.activeElement?.classList.contains('fd-gantt-task') ?? false);
        for (let i = 0; i < 8 && !(await onABar()); i++) await keys('Tab');
        await see(focused).toHaveClass(/fd-gantt-task/);
        const id = (await focused.getAttribute('data-id'))!;
        const name = (await focused.innerText()).trim();
        const bar = page.locator(`.fd-gantt-task[data-id="${id}"]`);
        // Down to the bar below, up again.
        await keys('ArrowDown');
        await see(focused).not.toHaveAttribute('data-id', id);
        await see(focused).toHaveClass(/fd-gantt-task/);
        await keys('ArrowUp');
        await see(bar).toBeFocused();
        const at = (await bar.boundingBox())!.x;
        const days = Number(/, (\d+) days?/.exec((await bar.getAttribute('aria-label'))!)![1]);
        // A day on, and back.
        await keys('ArrowRight');
        await see(said).toContainText(`Moved ${name}: `);
        await expect.poll(async () => Math.round((await bar.boundingBox())!.x - at)).toBe(40);
        await keys('ArrowLeft');
        await expect.poll(async () => Math.round((await bar.boundingBox())!.x - at)).toBe(0);
        // With Shift, its end: a day more, and back.
        await keys('Shift+ArrowRight');
        await see(said).toContainText(`${name} now ends `);
        await see(bar).toHaveAttribute('aria-label', new RegExp(`, ${days + 1} days`));
        await keys('Shift+ArrowLeft');
        await see(bar).toHaveAttribute('aria-label', new RegExp(`, ${days} days?`));
        await see(bar).toBeFocused();
        // Enter opens the task.
        await keys('Enter');
        await see(page.locator('[data-node="f-name"] input')).toHaveValue(name);
        await see(page.locator('.dh-title')).toHaveText('A fit-out task');
      },
    },
    {
      says: 'The suspended ceiling starts before the partitions it waits for',
      async run({ page, see }) {
        // Back on the plan, from the task the step before opened (the browser's Back).
        if (!(await page.locator('.fd-gantt').isVisible())) await page.goBack();
        const ceiling = page.locator('.fd-gantt-task').filter({ has: page.locator('.fd-gantt-task-text', { hasText: /^Suspended ceiling$/ }) });
        await see(ceiling).toBeVisible();
        await see(page.locator('.fd-gantt-link[data-late]')).toHaveCount(1);
        const id = await ceiling.getAttribute('data-id');
        await see(page.locator(`.fd-gantt-link[data-late][data-to="${id}"]`)).toHaveCount(1);
        await see(ceiling).toHaveAttribute('data-late', '');
        await see(ceiling).toHaveAttribute('aria-label', /starts before Partitions ends/);
        await see(ceiling).toHaveAttribute('title', /starts before Partitions ends/);
      },
    },
    {
      says: 'Press Weeks or Months over the timeline, or a phase’s name to fold',
      async run({ page, press, see }) {
        const timeline = page.locator('.fd-gantt');
        const scales = page.getByRole('group', { name: 'Show the timeline by' });
        await press(scales.getByRole('button', { name: 'Weeks' }));
        await see(timeline).toHaveAttribute('data-zoom', 'week');
        await see(scales.getByRole('button', { name: 'Weeks' })).toHaveAttribute('aria-pressed', 'true');
        await press(scales.getByRole('button', { name: 'Months' }));
        await see(timeline).toHaveAttribute('data-zoom', 'month');
        const electrical = page.locator('.fd-gantt-task').filter({ hasText: /^Electrical first fix$/ });
        await see(electrical).toHaveCount(1);
        await press(page.getByRole('button', { name: 'Hide First fix' }));
        await see(electrical).toHaveCount(0);
        await see(page.getByRole('button', { name: 'Show First fix' })).toHaveAttribute('aria-expanded', 'false');
        await press(page.getByRole('button', { name: 'Show First fix' }));
        await see(electrical).toHaveCount(1);
      },
    },
    {
      says: 'Pick Electrics from the search menu: the timeline keeps',
      async run({ page, press, see }) {
        await press(page.getByRole('button', { name: 'Search options' }));
        await press(page.locator('.fd-search-panel').getByRole('button', { name: 'Electrics' }));
        await see(page.locator('.fd-gantt-task')).toHaveText(['Electrical first fix', 'Electrical second fix']);
      },
    },
  ],
};
