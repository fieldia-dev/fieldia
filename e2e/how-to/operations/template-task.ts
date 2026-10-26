import type { DemoReplay } from '../hand';

/** The template-task demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Click a stage along the top, and a star for the priority',
      async run({ page, press, see }) {
        const stages = page.getByRole('list', { name: 'Stage' });
        await press(stages.getByRole('button', { name: 'In review' }));
        await see(page.locator('.fd-statusbar [aria-current="step"]')).toHaveText('In review');
        const priority = page.getByRole('radiogroup', { name: 'Priority' });
        await press(priority.getByRole('radio', { name: 'Urgent' }));
        await see(priority.getByRole('radio', { name: 'Urgent' })).toBeChecked();
      },
    },
    {
      says: 'Add three checklist items and tick one: Progress shows 33%',
      async run({ page, press, type, see }) {
        await press(page.getByRole('tab', { name: 'Checklist' }));
        const checklist = page.getByRole('tabpanel', { name: 'Checklist' });
        for (const item of ['Draft the report', 'Check the figures', 'Send it']) {
          await press(checklist.getByRole('button', { name: '+ Add a line' }));
          const box = checklist.locator('tbody tr[data-line]').last().getByRole('textbox', { name: 'Item' });
          await type(box, item);
          await see(box).toHaveValue(item);
        }
        const rows = checklist.locator('tbody tr[data-line]');
        await see(rows).toHaveCount(3);
        await see(page.getByRole('progressbar', { name: 'Progress' })).toContainText('0%');
        await press(rows.first().getByRole('checkbox', { name: 'Done' }));
        await see(page.getByRole('progressbar', { name: 'Progress' })).toContainText('33%');
      },
    },
  ],
};
