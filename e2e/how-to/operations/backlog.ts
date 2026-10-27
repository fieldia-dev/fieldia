import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';

/** The backlog demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Click a bug in the backlog: it opens in a large popup over the list',
      async run({ page, press, see, phone }) {
        const bug = page.locator('.fd-list-row[data-id="4127"]');
        await see(bug).toBeVisible();
        await press(bug);
        const popup = page.getByRole('dialog');
        await see(popup).toBeVisible();
        await see(popup.getByText('BUG 4127')).toBeVisible();
        await see(popup.locator('[data-field="title"] textarea')).not.toHaveValue('');
        await see(bug).toHaveAttribute('aria-current', 'true');
        // Large: most of the window's width, the whole of it on a phone.
        const box = (await popup.boundingBox())!;
        const width = page.viewportSize()!.width;
        expect(box.width).toBeGreaterThanOrEqual(phone ? width - 1 : width * 0.75);
        await see(page.locator('.fd-list-row').first()).toBeAttached();
      },
    },
    {
      says: 'Open Area and Iteration: Suggestions first, then the tree with each',
      async run({ page, press, keys, see }) {
        const popup = page.getByRole('dialog');
        await press(popup.locator('[data-node="f-area"] input'));
        const suggestions = page.getByRole('group', { name: 'Suggestions' });
        await see(suggestions.getByRole('treeitem')).toHaveText(['Portal']);
        await see(page.locator('.fd-path-callout:popover-open [role=tree] > [role=treeitem]')).toHaveText(['Portal']);
        await keys('Escape');
        await see(suggestions).toBeHidden();
        await press(popup.locator('[data-node="f-iteration"] input'));
        const sprints = suggestions.getByRole('treeitem');
        await see(sprints.first()).toBeVisible();
        await see(sprints.nth(0)).toContainText('Portal\\Sprint 12');
        await see(sprints.nth(0)).toContainText('3/25/2026 - 4/16/2026');
        await see(sprints.nth(1)).toContainText('Portal\\Sprint 14');
        // Then the tree, each sprint with its dates.
        const tree = page.locator('.fd-path-callout:popover-open [role=tree]').last();
        await see(tree).toBeVisible();
        await see(tree).toContainText(/Sprint \d+[\s\S]*\d{1,2}\/\d{1,2}\/2026 - \d{1,2}\/\d{1,2}\/2026/);
        await keys('Escape');
      },
    },
    {
      says: 'Click into System Info: the toolbar appears inside the box',
      async run({ page, press, see }) {
        const system = page.getByRole('dialog').locator('[data-node="f-system"]');
        const tools = system.getByRole('toolbar', { name: 'Formatting' });
        await see(tools).toBeHidden();
        await press(system.locator('.fd-text-area'));
        await see(tools).toBeVisible();
        await see(tools.getByRole('button', { name: 'Bold' })).toBeVisible();
        // Inside the box: within its edges.
        const [bar, box] = await Promise.all([tools.boundingBox(), system.locator('.fd-text-area').locator('xpath=..').boundingBox()]);
        expect(bar!.y).toBeGreaterThanOrEqual(box!.y - 1);
        expect(bar!.y + bar!.height).toBeLessThanOrEqual(box!.y + box!.height + 1);
      },
    },
    {
      says: 'Write a comment and Save it: the count in the head follows',
      async run({ page, press, see }) {
        const popup = page.getByRole('dialog');
        await see(popup.getByRole('button', { name: /1 Comment/ })).toBeVisible();
        await press(page.locator('.fd-composer-card .fd-text-area'));
        await page.keyboard.type('The scanner is back: 3 of 15 left the shelf twice.', { delay: 15 });
        await press(page.locator('.fd-composer-card').getByRole('button', { name: 'Save' }));
        await see(page.locator('li.fd-comment-card')).toHaveCount(2);
        await see(page.locator('li.fd-comment-card').filter({ hasText: 'The scanner is back' })).toBeVisible();
        await see(popup.getByRole('button', { name: /2 Comments/ })).toBeVisible();
      },
    },
    {
      says: 'Open the History tab: the State Graph, then each change with its',
      async run({ page, press, see }) {
        const popup = page.getByRole('dialog');
        await press(popup.getByRole('tab', { name: 'History' }));
        await see(popup.getByText('State Graph')).toBeVisible();
        await see(popup.getByRole('list', { name: 'State Graph' }).getByRole('listitem').first()).toBeVisible();
        const change = page.getByRole('option', { name: /1999979534/ }).first();
        await press(change);
        const detail = popup.locator('.fd-history-detail');
        await see(detail).toContainText('Wed 7/22/2026');
        // Each change with what was before and what came after.
        await see(detail.locator('.fd-history-new').first()).toHaveText('1999979534');
        await see(detail.locator('.fd-history-old').first()).toContainText('1999987060');
      },
    },
  ],
};
