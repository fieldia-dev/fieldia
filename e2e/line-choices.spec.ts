import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open, screen } from './support';

/**
 * An AI agent's tools (the agent-tools demo, nexibi's asks FA-2 and FA-6): each line's Tool is a choice from the app's
 * list, by the connection on that line — offered its own connection's tools, asked again as the connection changes, a
 * tool the new connection lacks cleared and said under its cell, one it has kept. In the grid alike, said aloud; and a
 * block pasted reads each tool among its own line's connection's.
 */

// The clipboard is the browser's, one for every page a worker has open: these tests take turns with it.
test.describe.configure({ mode: 'default' });

type Line = { key: string; values: Record<string, unknown> };
const linesOf = (page: Page, field: string) => page.evaluate((name) => (window as any).fieldiaDemo.handle.form.getState().values[name] as Line[], field);
const connectionOf = (line: Line | undefined) => (line?.values['connection_id'] as { label: string } | null)?.label ?? null;

const tools = (page: Page) => node(page, 'f-tools');
const row = (page: Page, n: number) => tools(page).locator('tbody tr[data-line]').nth(n);
const tool = (page: Page, n: number) => row(page, n).locator('td[data-column="tool"] select');
const connection = (page: Page, n: number) => row(page, n).locator('td[data-column="connection_id"] input[role="combobox"]');
const said = (page: Page, n: number) => row(page, n).locator('td[data-column="tool"] [role="status"]:not([hidden])');
const offered = async (page: Page, n: number) => (await tool(page, n).locator('option').allTextContents()).filter(Boolean);

/** Type into a link's box and pick the option named, with the keys. */
async function pick(page: Page, box: Locator, typed: string, option: string) {
  await box.click();
  await box.fill(typed);
  const list = page.getByRole('option', { name: option, exact: true });
  await expect(list).toBeVisible();
  await list.click();
  await expect(box).toHaveValue(option);
}

const GMAIL = ['Search mail', 'Send an email', 'Draft a reply', 'Add a label'];
const SLACK = ['Search messages', 'Post in a channel', 'Send a direct message'];

test.describe('an AI agent’s tools, each line’s from its connection', () => {
  test('offers each line its own connection’s tools, by their names', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=agent-tools&skin=underline');
    await expect.poll(() => offered(page, 0)).toEqual(GMAIL);
    // Each line once.
    await expect(tools(page).locator('tbody tr[data-line]')).toHaveCount(4);
    await expect.poll(() => offered(page, 3)).toEqual(SLACK);
    await expect.poll(() => offered(page, 2)).toEqual(['Search contacts', 'Create a deal', 'Log a call']);
    await expect(tool(page, 0).locator('option:checked')).toHaveText('Send an email');
    await expect(tool(page, 2).locator('option:checked')).toHaveText('Search contacts');
    await screen(page, 'line-choices-tools');
    expect(problems).toEqual([]);
  });

  test('a line’s connection changed: its tools asked again, one the new connection lacks cleared and said, one it has kept', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=agent-tools&skin=underline');
    await expect.poll(() => offered(page, 0)).toEqual(GMAIL);
    await pick(page, connection(page, 0), 'Slack', 'Slack — Nile Traders');
    await expect.poll(() => offered(page, 0)).toEqual(SLACK);
    await expect(tool(page, 0)).toHaveValue('');
    await expect(said(page, 0)).toHaveText('Send an email is no longer offered, so it was taken out');
    // Search: Slack searches too, in its own words.
    await pick(page, connection(page, 1), 'Slack', 'Slack — Nile Traders');
    await expect.poll(() => offered(page, 1)).toEqual(SLACK);
    await expect(tool(page, 1).locator('option:checked')).toHaveText('Search messages');
    await expect(said(page, 1)).toHaveCount(0);
    const lines = await linesOf(page, 'tool_ids');
    expect([connectionOf(lines[0]), lines[0].values['tool'], connectionOf(lines[1]), lines[1].values['tool']]).toEqual(['Slack — Nile Traders', null, 'Slack — Nile Traders', 'search']);
    await screen(page, 'line-choices-cleared', { viewport: true });
    // A tool chosen: the words go.
    await tool(page, 0).selectOption({ label: 'Post in a channel' });
    await expect(said(page, 0)).toHaveCount(0);
    await expect.poll(async () => (await linesOf(page, 'tool_ids'))[0].values['tool']).toBe('post_message');
    expect(problems).toEqual([]);
  });

  test('a new line’s tools wait for its connection, then are its own', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=agent-tools&skin=underline');
    await tools(page).locator('.fd-lines-add').first().click();
    await expect.poll(() => offered(page, 4)).toEqual([]);
    await pick(page, connection(page, 4), 'Drive', 'Google Drive — Shared drive');
    await expect.poll(() => offered(page, 4)).toEqual(['Search files', 'Read a file', 'Create a document']);
    await tool(page, 4).selectOption({ label: 'Read a file' });
    await expect.poll(async () => (await linesOf(page, 'tool_ids'))[4].values['tool']).toBe('read_file');
    expect(problems).toEqual([]);
  });

  test.describe('rows pasted from a spreadsheet', () => {
    test.beforeEach(async ({ context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    });

    test('each tool read among its own row’s connection’s; one that connection lacks named', async ({ page }) => {
      const { problems } = await open(page, 'plain', 'page=agent-tools&skin=underline');
      await expect.poll(() => offered(page, 0)).toEqual(GMAIL);
      await connection(page, 2).click();
      await page.evaluate((text) => navigator.clipboard.writeText(text), 'Google Drive — Shared drive\tCreate a document\nSlack — Nile Traders\tLog a call\n');
      await page.keyboard.press('Control+V');
      await expect(tools(page).locator('.fd-lines-paste-note')).toHaveText(
        'Pasted into 3 cells. Not pasted: Tool, line 4 (Tool: nothing is called “⁨Log a call⁩”; pick one from the list)'
      );
      const lines = await linesOf(page, 'tool_ids');
      expect([connectionOf(lines[2]), lines[2].values['tool']]).toEqual(['Google Drive — Shared drive', 'create_document']);
      // Slack's line keeps what Slack offers: Post in a channel, as it was.
      expect([connectionOf(lines[3]), lines[3].values['tool']]).toEqual(['Slack — Nile Traders', 'post_message']);
      await expect.poll(() => offered(page, 2)).toEqual(['Search files', 'Read a file', 'Create a document']);
      await expect(tool(page, 2).locator('option:checked')).toHaveText('Create a document');
      await screen(page, 'line-choices-pasted', { viewport: true });
      expect(problems).toEqual([]);
    });
  });
});

test.describe('what starts the agent, in the grid', () => {
  const grid = (page: Page) => node(page, 'f-triggers');
  const cell = (page: Page, n: number, column: string) => grid(page).locator(`.ag-row[row-index="${n}"] .ag-cell[col-id="${column}"]`);

  test('says each start’s event by its connection’s words; a connection changed clears one it lacks, said aloud', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=agent-tools&skin=underline');
    await expect(cell(page, 0, 'event')).toHaveText('A new email arrives');
    await expect(cell(page, 1, 'event')).toHaveText('Someone mentions the agent');
    await cell(page, 0, 'connection_id').click();
    const box = grid(page).locator('.fd-grid-editor input[role="combobox"]');
    await expect(box).toBeFocused();
    await box.fill('HubSpot');
    await page.getByRole('option', { name: 'HubSpot — Sales', exact: true }).click();
    await expect(box).toHaveValue('HubSpot — Sales');
    // Enter takes the cell, as the grid takes a cell's value.
    await page.keyboard.press('Enter');
    await expect(grid(page).locator('.fd-grid-editor')).toHaveCount(0);
    await expect(cell(page, 0, 'connection_id')).toHaveText('HubSpot — Sales');
    await expect(cell(page, 0, 'event')).toHaveText('');
    await expect(grid(page).locator('.fd-sr-only[role="status"]', { hasText: 'Line 1:' })).toHaveText('Line 1: A new email arrives is no longer offered, so it was taken out');
    // The event chosen again, among HubSpot's.
    await cell(page, 0, 'event').click();
    const events = grid(page).locator('.fd-grid-editor select');
    await expect.poll(async () => (await events.locator('option').allTextContents()).filter(Boolean)).toEqual(['A deal changes stage', 'A new contact']);
    await events.selectOption({ label: 'A deal changes stage' });
    await page.keyboard.press('Enter');
    await expect(cell(page, 0, 'event')).toHaveText('A deal changes stage');
    await screen(page, 'line-choices-grid', { viewport: true });
    expect(problems).toEqual([]);
  });

  test('a start opened in its own form offers its connection’s events, and clears one the connection changed to lacks', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=agent-tools&skin=underline');
    await expect(cell(page, 1, 'event')).toHaveText('Someone mentions the agent');
    await grid(page).locator('.ag-row[row-index="1"] .fd-line-open, .ag-row[row-index="1"] [aria-label*="Open"]').first().click();
    const dialog = page.locator('.fd-form-dialog');
    await expect(dialog).toBeVisible();
    const event = dialog.locator('select').first();
    await expect.poll(async () => (await event.locator('option').allTextContents()).filter(Boolean)).toEqual(['Someone mentions the agent', 'A new message in a channel']);
    await expect(event.locator('option:checked')).toHaveText('Someone mentions the agent');
    await pick(page, dialog.getByRole('combobox').first(), 'Drive', 'Google Drive — Shared drive');
    await expect.poll(async () => (await event.locator('option').allTextContents()).filter(Boolean)).toEqual(['A file is added']);
    await expect(event).toHaveValue('');
    await expect(dialog.locator('[role="status"]:not([hidden])', { hasText: 'taken out' })).toHaveText('Someone mentions the agent is no longer offered, so it was taken out');
    await screen(page, 'line-choices-dialog', { viewport: true });
    expect(problems).toEqual([]);
  });
});
