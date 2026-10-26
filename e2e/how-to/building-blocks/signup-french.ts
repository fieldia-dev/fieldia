import type { DemoReplay } from '../hand';

/** The signup-french demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Read the page: its title, sections and questions come from the app’s French catalog.',
      async run({ page, see }) {
        await see(page.getByRole('heading', { name: 'Inscription à l’atelier' })).toBeVisible();
        await see(page.getByText('Une journée pour construire des formulaires que l’on termine. Le Caire, 14 novembre.')).toBeVisible();
        await see(page.getByRole('group', { name: 'À propos de vous' })).toBeVisible();
        for (const question of ['Nom complet', 'E-mail', 'Entreprise', 'Votre rôle', 'Téléphone mobile']) await see(page.getByRole('textbox', { name: question }).or(page.getByRole('combobox', { name: question }))).toBeVisible();
        // Every section and every question, not the first section's alone: none left in the page's own English.
        for (const section of ['Votre travail', 'La journée']) await see(page.getByRole('group', { name: section, exact: true })).toBeVisible();
        await see(page.getByRole('radiogroup', { name: 'Expérience des outils de formulaires' }).getByRole('radio')).toHaveCount(3);
        for (const choice of ['Aucune pour l’instant', 'Un peu', 'Beaucoup']) await see(page.getByRole('radio', { name: choice })).toBeVisible();
        for (const question of ['Votre tarif horaire', 'Arrivée le', 'Prix du billet']) await see(page.getByRole('textbox', { name: question })).toBeVisible();
        await see(page.getByRole('switch', { name: 'Présent au dîner' })).toBeVisible();
        await see(page.getByRole('checkbox', { name: 'Envoyez-moi les notes de l’atelier' })).toBeVisible();
        await see(page.getByText('Facultatif. Sert seulement à l’exercice sur les prix.')).toBeVisible();
        // The page's own words: the captcha under it is its service's, in the service's words.
        for (const english of ['Your work', 'The day', 'Experience with form builders', 'None yet', 'Your hourly rate', 'Arriving on', 'Ticket price', 'Joining the dinner', 'Send me the workshop notes']) {
          await see(page.locator('.fd-form').first().getByText(english, { exact: true })).toHaveCount(0);
        }
      },
    },
    {
      says: 'Type in a field: what you type is left as it is.',
      async run({ page, type, see }) {
        // Words the catalog has, typed: kept as typed, never put into French.
        const company = page.getByRole('textbox', { name: 'Entreprise' });
        await type(company, 'Full name');
        await see(company).toHaveValue('Full name');
        const name = page.getByRole('textbox', { name: 'Nom complet' });
        await type(name, 'Company');
        await see(name).toHaveValue('Company');
      },
    },
  ],
};
