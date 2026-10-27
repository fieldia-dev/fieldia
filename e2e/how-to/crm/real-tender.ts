import type { DemoReplay } from '../hand';

/** The real-tender demo’s how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  timeout: 90_000,
  steps: [
    {
      says: 'Open Requirements and tick Compliant on “Three',
      async run({ page, press, see }) {
        await press(page.getByRole('tab', { name: 'Requirements' }));
        const bar = page.getByRole('progressbar', { name: 'Compliance %' });
        // Five of seven compliant: 71 %; six of seven once it is ticked: 86 %.
        await see(bar).toContainText('71%');
        // Its row, by the words in its Requirement box.
        const rows = page.locator('[data-node="f-requirements"] tbody tr');
        const words = await rows.getByRole('textbox', { name: 'Requirement' }).evaluateAll((boxes) => boxes.map((box) => (box as HTMLInputElement).value));
        const row = rows.nth(words.findIndex((one) => one.startsWith('Three similar projects')));
        const compliant = row.getByRole('checkbox', { name: 'Compliant' });
        await see(compliant).not.toBeChecked();
        await press(compliant);
        await see(compliant).toBeChecked();
        await see(bar).toContainText('86%');
      },
    },
    {
      says: 'Add a requirement with Add a line: the bar',
      async run({ page, press, see }) {
        const table = page.locator('[data-node="f-requirements"]');
        const rows = table.locator('tbody tr');
        const before = await rows.count();
        await press(table.getByRole('button', { name: 'Add a line' }));
        await see(rows).toHaveCount(before + 1);
        const added = rows.last().getByRole('textbox', { name: 'Requirement' });
        await see(added).toBeFocused();
        await page.keyboard.type('Site visit certificate', { delay: 15 });
        await see(added).toHaveValue('Site visit certificate');
        // Six of eight compliant now: 75 %.
        await see(page.getByRole('progressbar', { name: 'Compliance %' })).toContainText('75%');
      },
    },
    {
      says: 'In Lots, untick We Are Bidding on Lot 2: Our',
      async run({ page, press, see }) {
        await press(page.getByRole('tab', { name: 'Financial' }));
        const bid = page.getByRole('textbox', { name: 'Our Bid Amount' });
        await see(bid).toHaveValue('25,350,000.00');
        await press(page.getByRole('tab', { name: 'Lots' }));
        const lot2 = page.locator('[data-node="f-lots"] tbody tr').nth(1);
        const bidding = lot2.getByRole('checkbox', { name: 'We Are Bidding' });
        await see(bidding).toBeChecked();
        await press(bidding);
        await see(bidding).not.toBeChecked();
        await press(page.getByRole('tab', { name: 'Financial' }));
        // Lot 2's quotation, 6,900,000, out of the bid.
        await see(bid).toHaveValue('18,450,000.00');
      },
    },
    {
      says: 'Press Submit Bid: the tender moves to Submitted,',
      async run({ page, press, see }) {
        await see(page.getByRole('button', { name: 'Mark Lost' })).toBeHidden();
        await press(page.getByRole('button', { name: 'Submit Bid' }));
        await see(page.locator('.fd-statusbar [aria-current="step"]')).toHaveText(/^Submitted/);
        await see(page.getByRole('button', { name: 'Mark Won' })).toBeVisible();
        await see(page.getByRole('button', { name: 'Mark Lost' })).toBeVisible();
      },
    },
    {
      says: 'Press Mark Lost, fill in the loss analysis and',
      async run({ page, press, type, see }) {
        await press(page.getByRole('button', { name: 'Mark Lost' }));
        const dialog = page.getByRole('dialog', { name: 'Loss Analysis' });
        await see(dialog).toBeVisible();
        // The page's own list (a <select>): its option picked as the browser's list picks it.
        await dialog.locator('[data-node="f-loss-reason"] select').selectOption({ label: 'Price Too High' });
        await type(dialog.locator('[data-node="f-loss-notes"] textarea'), 'Pyramids Contracting came in 9% lower on Lot 1.');
        const competitor = dialog.locator('[data-node="f-winning-competitor"]').getByRole('combobox');
        await type(competitor, 'Pyramids');
        await press(dialog.getByRole('option', { name: 'Pyramids Contracting', exact: true }));
        await see(competitor).toHaveValue('Pyramids Contracting');
        await type(dialog.locator('[data-node="f-lessons"] textarea'), 'Price the installation lot apart next time.');
        await press(dialog.getByRole('button', { name: 'Confirm Loss' }));
        await see(dialog).toBeHidden();
        await see(page.locator('.fd-statusbar [aria-current="step"]')).toHaveText(/^Lost/);
        await press(page.getByRole('tab', { name: 'Results' }));
        await see(page.locator('[data-node="f-loss-reason"] select option:checked')).toHaveText('Price Too High');
        await see(page.locator('[data-node="f-loss-notes"] textarea')).toHaveValue('Pyramids Contracting came in 9% lower on Lot 1.');
        await see(page.locator('[data-node="f-winning-competitor"]').getByRole('combobox')).toHaveValue('Pyramids Contracting');
      },
    },
  ],
};
