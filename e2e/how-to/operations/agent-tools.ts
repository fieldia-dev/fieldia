import type { DemoReplay } from '../hand';

/** The agent-tools demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Open Tool on the first line, then on the Slack line: each offers',
      async run({ page, press, keys, see, phone }) {
        const lines = page.locator('[data-node="f-tools"] tbody tr[data-line]');
        const tool = (n: number) => lines.nth(n).getByRole('combobox', { name: 'Tool' });
        const offered = (n: number) => tool(n).locator('option').filter({ hasText: /./ });
        await see(lines).toHaveCount(4);
        // The tools come from the app a moment after the page (as from a server): Tool pressed at once, before they
        // have come, keeps the focus and its open list as they do — the same select, its tools filled in.
        await press(tool(0));
        await see(offered(0)).toHaveCount(4);
        // Each Tool opened: the browser's own list, of the line's connection's tools.
        await see(tool(0)).toBeFocused();
        await see(offered(0)).toHaveText(['Search mail', 'Send an email', 'Draft a reply', 'Add a label']);
        // Closed again (a phone's picker closes as the next tap lands).
        if (!phone) await keys('Escape');
        await see(lines.nth(3).getByRole('combobox', { name: 'Connection' })).toHaveValue('Slack — Nile Traders');
        await press(tool(3));
        await see(tool(3)).toBeFocused();
        await see(offered(3)).toHaveText(['Search messages', 'Post in a channel', 'Send a direct message']);
        if (!phone) await keys('Escape');
      },
    },
    {
      says: 'Change the first line’s connection to Slack: its tools load again',
      async run({ page, press, type, see }) {
        const lines = page.locator('[data-node="f-tools"] tbody tr[data-line]');
        const tool = (n: number) => lines.nth(n).getByRole('combobox', { name: 'Tool' });
        const said = (n: number) => lines.nth(n).locator('td[data-column="tool"] [role="status"]:not([hidden])');
        const toSlack = async (n: number) => {
          const connection = lines.nth(n).getByRole('combobox', { name: 'Connection' });
          await type(connection, 'Slack', { clear: true });
          await press(page.getByRole('option', { name: 'Slack — Nile Traders', exact: true }));
          await see(connection).toHaveValue('Slack — Nile Traders');
        };
        await toSlack(0);
        await see(tool(0).locator('option').filter({ hasText: /./ })).toHaveText(['Search messages', 'Post in a channel', 'Send a direct message']);
        await see(tool(0)).toHaveValue('');
        await see(said(0)).toHaveText('Send an email is no longer offered, so it was taken out');
        // The second line's Search: Slack searches too, in its own words.
        await see(tool(1).locator('option:checked')).toHaveText('Search mail');
        await toSlack(1);
        await see(tool(1).locator('option').filter({ hasText: /./ })).toHaveText(['Search messages', 'Post in a channel', 'Send a direct message']);
        await see(tool(1).locator('option:checked')).toHaveText('Search messages');
        await see(said(1)).toHaveCount(0);
      },
    },
    {
      says: 'In When it starts, change a start’s connection: its event is said',
      async run({ page, press, type, keys, see, phone }) {
        const starts = page.locator('[data-node="f-triggers"]');
        const gone = 'A new email arrives is no longer offered, so it was taken out';
        if (phone) {
          // A phone's start is a card: opened by its name, changed in its own form.
          const card = starts.locator('.fd-line-card').first();
          await see(card.locator('.fd-line-card-title')).toHaveText('Gmail — sales@niletraders.example');
          await see(card.locator('dd').first()).toHaveText('A new email arrives');
          await press(card.locator('.fd-line-card-title'));
          const start = page.locator('.fd-form-dialog');
          await see(start).toBeVisible();
          const connection = start.getByRole('combobox').first();
          await type(connection, 'HubSpot', { clear: true });
          await press(page.getByRole('option', { name: 'HubSpot — Sales', exact: true }));
          await see(connection).toHaveValue('HubSpot — Sales');
          await see(start.locator('[role="status"]:not([hidden])', { hasText: 'taken out' })).toHaveText(gone);
          await see(start.locator('select').first()).toHaveValue('');
        } else {
          const cell = (column: string) => starts.locator(`.ag-row[row-index="0"]:not(.fd-grid-totals) .ag-cell[col-id="${column}"]`);
          await see(cell('event')).toHaveText('A new email arrives');
          await press(cell('connection_id'));
          const box = starts.locator('.fd-grid-editor input[role="combobox"]');
          await see(box).toBeFocused();
          await keys('ControlOrMeta+a');
          await page.keyboard.type('HubSpot', { delay: 15 });
          await press(page.getByRole('option', { name: 'HubSpot — Sales', exact: true }));
          await see(box).toHaveValue('HubSpot — Sales');
          await keys('Enter');
          await see(cell('connection_id')).toHaveText('HubSpot — Sales');
          // Under the cell, and said aloud.
          await see(cell('event').locator('.fd-grid-taken-out')).toHaveText(gone);
          await see(starts.locator('.fd-sr-only[role="status"]', { hasText: 'Line 1:' })).toHaveText(`Line 1: ${gone}`);
        }
      },
    },
  ],
};
