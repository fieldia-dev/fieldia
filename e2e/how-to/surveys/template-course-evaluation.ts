import type { DemoReplay } from '../hand';

/** The template-course-evaluation demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Rate each part of the course on the grid, one answer a row.',
      async run({ page, press, see }) {
        const marks: [string, string][] = [['The content', 'Very good'], ['The pace', 'Fair'], ['The materials', 'Excellent'], ['The trainer', 'Very good']];
        for (const [part, mark] of marks) await press(page.getByRole('radio', { name: `${part}: ${mark}` }));
        for (const [part, mark] of marks) await see(page.getByRole('radio', { name: `${part}: ${mark}` })).toBeChecked();
        // One answer a row: another in the same row takes the first one's place.
        await press(page.getByRole('radio', { name: 'The pace: Good' }));
        await see(page.getByRole('radio', { name: 'The pace: Good' })).toBeChecked();
        await see(page.getByRole('radio', { name: 'The pace: Fair' })).not.toBeChecked();
        await see(page.getByRole('radiogroup', { name: 'The pace' }).getByRole('radio', { checked: true })).toHaveCount(1);
      },
    },
    {
      says: 'Give the course an overall rating, then answer the two open questions.',
      async run({ page, press, type, see }) {
        const overall = page.getByRole('radiogroup', { name: /Overall, how would you rate the course\?/ });
        await press(overall.getByRole('radio', { name: '4 of 5' }));
        await see(overall.getByRole('radio', { name: '4 of 5' })).toBeChecked();
        const useful = page.getByRole('textbox', { name: 'What was the most useful part?' });
        const change = page.getByRole('textbox', { name: 'What should we change?' });
        await type(useful, 'The exercises on real data.');
        await type(change, 'More time for questions.');
        await see(useful).toHaveValue('The exercises on real data.');
        await see(change).toHaveValue('More time for questions.');
      },
    },
  ],
};
