import type { DemoReplay } from '../hand';

/** The template-customer demo’s how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Choose Person or Company above the name, and',
      async run({ page, press, type, keys, see }) {
        await see(page.getByRole('radio', { name: 'Company' })).toBeChecked();
        await press(page.getByRole('radio', { name: 'Person' }));
        await see(page.getByRole('radio', { name: 'Person' })).toBeChecked();
        await type(page.getByRole('textbox', { name: 'Customer Name' }), 'Lina Haddad');
        const phone = page.getByRole('textbox', { name: 'Phone' });
        await type(phone, '+962 79 555 0142');
        const email = page.getByRole('textbox', { name: 'Email' });
        await type(email, 'lina.haddad@ammanfresh.example');
        await keys('Tab');
        await see(phone).toHaveValue('+962 79 555 0142');
        await see(email).toHaveValue('lina.haddad@ammanfresh.example');
        await see(email).toHaveAttribute('aria-invalid', 'false');
      },
    },
    {
      says: 'Add a contact in the Contacts tab, and the',
      async run({ page, press, keys, type, see }) {
        await press(page.getByRole('tab', { name: 'Contacts' }));
        const contacts = page.getByRole('tabpanel', { name: 'Contacts' });
        await press(contacts.getByRole('button', { name: '+ Add a line' }));
        const rows = contacts.locator('tbody tr');
        await see(rows).toHaveCount(1);
        const name = rows.first().getByRole('textbox', { name: 'Name' });
        await see(name).toBeFocused();
        await page.keyboard.type('Omar Said', { delay: 15 });
        await keys('Tab');
        await page.keyboard.type('Buyer', { delay: 15 });
        await see(name).toHaveValue('Omar Said');
        await see(rows.first().getByRole('textbox', { name: 'Job' })).toHaveValue('Buyer');
        await press(page.getByRole('tab', { name: 'Sales and payment' }));
        const credit = page.getByRole('tabpanel', { name: 'Sales and payment' }).getByRole('textbox', { name: 'Credit limit' });
        await type(credit, '50000');
        await keys('Tab');
        await see(credit).toHaveValue(/^50,000(\.00)?$/);
      },
    },
  ],
};
