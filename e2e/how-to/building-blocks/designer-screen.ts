import { expect } from '../../fixtures';
import type { DemoReplay, Hand } from '../hand';

/** A button of the designer's bar as a person reaches it: in the bar, or on a phone under its More, opened first. */
async function inTheBar({ page, press }: Hand, name: string) {
  const target = page.locator('.fd-designer-bar').getByRole('button', { name, exact: true }).first();
  const more = page.locator('.fd-designer-bar .fd-bar-more');
  if (!(await target.isVisible()) && (await more.isVisible()) && (await more.getAttribute('aria-expanded')) !== 'true') await press(more);
  return target;
}

/** The designer-screen demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  timeout: 90_000,
  steps: [
    {
      says: 'Drag Email from the toolbox into the Visit section, under Notes: a gap opens where it will land.',
      notOnPhone: 'a drag: Playwright’s WebKit has no finger drag (a phone adds a field from the toolbox’s sheet by a tap)',
      async run({ page, press, see }) {
        await see(page.locator('.fd-designer-bar')).toBeVisible();
        // The toolbox, where it is: beside the page, or behind its button.
        const open = page.getByRole('button', { name: 'Open the toolbox' });
        if (await open.isVisible()) await press(open);
        const email = page.locator('.fd-toolbox [data-tool="kind:email"]');
        await see(email).toBeVisible();
        const photos = page.getByRole('button', { name: /^Photos/ });
        const notes = page.getByRole('button', { name: 'Notes', exact: true });
        const [from, under] = [(await email.boundingBox())!, (await photos.boundingBox())!];
        // Pressed on Email, carried at a hand's pace to the top of Photos — under Notes — and held there.
        await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
        await page.mouse.down();
        const to = { x: under.x + under.width / 2, y: under.y + 24 };
        for (let i = 1; i <= 12; i++) await page.mouse.move(from.x + from.width / 2 + ((to.x - from.x - from.width / 2) * i) / 12, from.y + from.height / 2 + ((to.y - from.y - from.height / 2) * i) / 12, { steps: 3 });
        const gap = page.locator('.fd-drop-slot');
        await see(gap).toBeVisible();
        // The gap, opened on the way, pushes the fields under it down: the hand follows Photos' top, as an eye does,
        // until the gap stands where the hand is.
        for (let look = 0; look < 5; look++) {
          const [slot, below] = [(await gap.boundingBox())!, (await photos.boundingBox())!];
          if (slot.y >= (await notes.boundingBox())!.y) break;
          await page.mouse.move(below.x + below.width / 2, below.y + 24, { steps: 4 });
          await expect.poll(async () => JSON.stringify(await gap.boundingBox()), { intervals: [100, 100, 100] }).not.toBe(JSON.stringify(slot));
        }
        // Where it will land: under Notes, over Photos.
        const [slot, above] = [(await gap.boundingBox())!, (await notes.boundingBox())!];
        expect(slot.y).toBeGreaterThanOrEqual(above.y + above.height - 2);
        expect(slot.y + slot.height).toBeLessThanOrEqual((await photos.boundingBox())!.y + 2);
        await page.mouse.up();
        await see(gap).toHaveCount(0);
        const visit = page.getByRole('group', { name: 'Visit' });
        await see(visit.locator('.fd-canvas-field')).toHaveCount(5);
        const labels = await visit.locator('.fd-canvas-field').evaluateAll((all) => all.map((one) => one.getAttribute('aria-label') ?? one.textContent?.trim() ?? ''));
        expect(labels.findIndex((one) => one.startsWith('Email'))).toBe(labels.findIndex((one) => one.startsWith('Notes')) + 1);
      },
    },
    {
      says: 'Press Visit date: type its label where it stands; the panel on the right sets the rest.',
      async run({ page, phone, press, see }) {
        const date = page.getByRole('button', { name: /^Visit date/ }).first();
        await press(date);
        const editing = page.locator('.fd-canvas-field.fd-editing');
        const label = editing.locator('[data-inline="label"]');
        await see(label).toBeVisible();
        await press(label);
        await page.keyboard.press('ControlOrMeta+a');
        await page.keyboard.type('Date of the visit', { delay: 15 });
        await see(label).toHaveValue('Date of the visit');
        // The rest of it, in the panel: its settings, for this field.
        const panel = page.getByRole('complementary', { name: 'Properties' });
        if (!phone) {
          const [box, side] = [(await page.locator('.fd-canvas-body').first().boundingBox())!, (await panel.boundingBox())!];
          expect(side.x).toBeGreaterThanOrEqual(box.x + box.width - 2);
        }
        await see(panel).toBeVisible();
        await see(panel.getByRole('textbox', { name: 'Label' })).toHaveValue('Date of the visit');
        await see(panel.getByRole('textbox', { name: 'Help text' })).toBeVisible();
      },
    },
    {
      says: 'Press Advanced to lay the screen out by dragging',
      notOnPhone: 'a drag: Playwright’s WebKit has no finger drag',
      async run({ page, press, see }) {
        await press(page.getByRole('group', { name: 'Editing mode' }).getByRole('button', { name: 'Advanced' }));
        await see(page.getByRole('group', { name: 'Editing mode' }).getByRole('button', { name: 'Advanced' })).toHaveAttribute('aria-pressed', 'true');
        const notes = page.getByRole('button', { name: 'Notes', exact: true });
        // The date, picked in step 2: Customer's neighbour in the Visit section.
        const date = page.getByRole('group', { name: 'Visit' }).locator('.fd-canvas-field').nth(1);
        await see(date.getByRole('textbox', { name: 'Label' })).toHaveValue('Date of the visit');
        // Notes in sight first: the date, still picked, stands open over it with its settings.
        await notes.scrollIntoViewIfNeeded();
        const [from, to] = [(await notes.boundingBox())!, (await date.boundingBox())!];
        await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
        await page.mouse.down();
        const end = { x: to.x + to.width - 12, y: to.y + to.height / 2 };
        const steps = Math.max(3, Math.ceil(Math.hypot(end.x - from.x - from.width / 2, end.y - from.y - from.height / 2) / 60));
        for (let i = 1; i <= steps; i++) await page.mouse.move(from.x + from.width / 2 + ((end.x - from.x - from.width / 2) * i) / steps, from.y + from.height / 2 + ((end.y - from.y - from.height / 2) * i) / steps);
        await page.mouse.move(end.x + 1, end.y);
        // Before it is let go: a line where it goes, and a chip that says so in words.
        const chip = page.locator('.fd-drop-chip');
        await see(chip).toBeVisible();
        await see(chip.locator('.fd-drop-where')).toContainText('after “Date of the visit”');
        await see(page.locator('.fd-drop-bar')).toBeVisible();
        await page.mouse.up();
        await see(chip).toBeHidden();
        // Let go: Notes beside the date, on its row, the width between them a handle of its own.
        await see(page.getByRole('separator', { name: 'Width between “Date of the visit” and “Notes”' })).toBeVisible();
        const placed = page.getByRole('group', { name: 'Visit' }).locator('.fd-canvas-field').nth(2);
        await see(placed.getByRole('textbox', { name: 'Label' })).toHaveValue('Notes');
        const [n, d] = [(await placed.boundingBox())!, (await date.boundingBox())!];
        expect(n.x).toBeGreaterThanOrEqual(d.x + d.width - 2);
        expect(Math.abs(n.y - d.y)).toBeLessThan(16);
      },
    },
    {
      says: 'Press Try it, then the phone: the screen works at a phone’s width.',
      async run(hand) {
        const { page, press, type, see } = hand;
        await press(await inTheBar(hand, 'Try it'));
        const tried = page.getByRole('region', { name: 'Try the page' });
        await see(tried).toBeVisible();
        const frame = page.locator('.fd-try-frame');
        const phoneWidth = tried.getByRole('group', { name: 'Width' }).getByRole('button', { name: 'Phone' });
        // On a desktop, the phone's width picked; a phone shows the page at its own width already.
        if (await phoneWidth.isVisible()) {
          await press(phoneWidth);
          await see(phoneWidth).toHaveAttribute('aria-pressed', 'true');
        }
        await expect.poll(async () => (await frame.boundingBox())!.width).toBeLessThanOrEqual(430);
        // It works there: typed in, and checked.
        const customer = tried.getByRole('textbox', { name: 'Customer' });
        await type(customer, 'Nile Traders');
        await see(customer).toHaveValue('Nile Traders');
        const box = (await customer.boundingBox())!;
        const shown = (await frame.boundingBox())!;
        expect(box.x + box.width).toBeLessThanOrEqual(shown.x + shown.width + 1);
      },
    },
    {
      says: 'Open a customer’s record, its model’s fields first in the toolbox, or a list of customers, by its columns.',
      async run(hand) {
        const { page, press, see, seePage } = hand;
        await hand.follow('a customer’s record');
        await seePage().toHaveURL(/\/screen\/\?start=sheet$/);
        await see(page.locator('.fd-designer-bar')).toBeVisible();
        const open = page.getByRole('button', { name: 'Open the toolbox' });
        if (await open.isVisible()) await press(open);
        const toolbox = page.getByRole('complementary', { name: 'Add a field' });
        await see(toolbox.getByRole('button', { name: /^From the model/ })).toBeVisible();
        // The model's fields first: before the kinds of field.
        const groups = await toolbox.getByRole('button', { expanded: true }).allTextContents();
        expect(groups[0]).toMatch(/^From the model/);
        await see(toolbox.getByRole('button', { name: 'VAT number' })).toBeVisible();
        // The toolbox put away again where it is a sheet over the page.
        const close = page.getByRole('button', { name: 'Close the toolbox' });
        if (await close.isVisible()) await press(close);
        await hand.follow('a list of customers');
        await seePage().toHaveURL(/\/screen\/\?start=list$/);
        await see(page.getByRole('columnheader')).toContainText(['Name', 'Email', 'Country', 'Status', 'Credit limit']);
        await see(page.getByRole('button', { name: 'Add a column' })).toBeVisible();
      },
    },
    {
      says: 'Start a blank screen and press Start from a schema…',
      async run(hand) {
        const { page, phone, press, pick, see, seePage } = hand;
        await hand.follow('Start a blank screen');
        await seePage().toHaveURL(/\/screen\/\?start=blank$/);
        await press(page.getByRole('button', { name: 'Start from a schema…' }));
        const dialog = page.getByRole('dialog', { name: 'Start from a schema' });
        await see(dialog).toBeVisible();
        const schema = JSON.stringify({
          title: 'Property enquiry',
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', title: 'Client' },
            email: { type: 'string', format: 'email' },
            bedrooms: { type: 'integer', minimum: 1, maximum: 9 },
            moveIn: { type: 'string', format: 'date' },
          },
        }, null, 2);
        if (phone) {
          // A phone's keyboard pastes from a menu Playwright's WebKit cannot open: the schema's file, chosen.
          await pick(dialog.getByRole('button', { name: 'Choose a file…' }), { name: 'enquiry.schema.json', mimeType: 'application/json', buffer: Buffer.from(schema) });
        } else {
          await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
          await page.evaluate((text) => navigator.clipboard.writeText(text), schema);
          await press(dialog.getByRole('textbox', { name: 'Schema, as JSON' }));
          await page.keyboard.press('Control+V');
        }
        // Before Start: the fields it makes, each with its kind.
        await see(dialog.locator('.fd-schema-count')).toHaveText('4 fields:');
        await see(dialog.locator('.fd-schema-field')).toHaveText(['Client', 'Email', 'Bedrooms', 'Move in']);
        await see(dialog.locator('.fd-schema-kind').first()).toBeVisible();
        await press(dialog.getByRole('button', { name: 'Start', exact: true }));
        await see(dialog).toBeHidden();
        await see(page.locator('.fd-start-done-words')).toHaveText('Started from the schema: 4 fields.');
        await see(page.locator('.fd-canvas-field')).toHaveCount(4);
      },
    },
  ],
};
