import { demoHref as demo, featurePage } from '../feature-page.mjs';

/** A feature page: Looks and languages. How a page dresses to fit a product, and speaks its readers' language. */
export default featurePage({
  path: '/features/looks/',
  folder: 'looks',
  title: 'Looks and languages',
  description: 'Looks and languages with Fieldia: eight themes, two skins, light and dark, your own colours, and English, Arabic, German and French right to left, with your app’s own words.',
  kicker: 'Looks and languages',
  headline: ['Your product’s look.', 'Your readers’ language.'],
  lede: 'Eight themes in the styles people know, two skins, light and dark, your own colours on top, and four languages built in with Arabic right to left in full. This record is live, in Arabic and dark.',
  opening: { frame: 'page=customer&skin=underline&scheme=dark&locale=ar&dir=rtl', title: 'A live customer record, in Arabic and dark' },
  parts: [
    {
      id: 'themes',
      no: 'Eight themes',
      title: 'Styles people already know, one line in the page',
      body: 'Material, Fluent, Apple, Bootstrap, shadcn, Ant Design, Odoo and Google Forms: each its own colours, shapes and type, light and dark, every pair of colours checked at WCAG AA.',
      ticks: ['"look": { "theme": "material" }, or a viewer option', 'Each theme light and dark, axe-clean in both', 'Your accent, font, spacing and corners over any theme', 'A theme switched in place, without drawing the form again'],
      shot: 'themes.png', alt: 'The same short form in four themes: Material, Fluent, Apple and Bootstrap', width: 912, height: 940,
      tryIt: ['See all eight', '/look/#themes'], docs: ['Themes, in the docs', '/look/'],
    },
    {
      id: 'dark',
      no: 'Light and dark',
      title: 'Dark when your app is, or when the reader’s system is',
      body: 'A page names its scheme, light, dark or the reader’s own, and every part follows: fields, tables, the chatter, dialogs. Or set your app’s colours with tokens, and they win over everything.',
      ticks: ['light, dark or auto, by the page or the viewer', 'Your own colours as tokens: one object, no stylesheet', 'Every colour from Fieldia’s variables, none fixed', 'Contrast checked in the browser, light and dark'],
      shot: 'dark.png', alt: 'A customer record in the dark scheme: status bar, stat buttons, a Key account badge and fields in light words on a dark ground', width: 1280, height: 640,
      tryIt: ['Try it dark', demo('page=customer&skin=underline&scheme=dark')], docs: ['Looks, in the docs', '/look/'],
    },
    {
      id: 'arabic',
      no: 'Right to left',
      title: 'Arabic, turned in full',
      body: 'Every part reads right to left: labels, status bars, tables, dialogs and the chatter, with the reader’s numbers and dates. German and French are built in too.',
      ticks: ['English, Arabic, German and French, each a small add-on script', 'Right to left in full, from layout to icons', 'Plurals and numbers in each language’s own rules', 'Tested in Arabic in every framework'],
      shot: 'arabic.png', alt: 'A customer record in Arabic, right to left: the status bar mirrored, the labels on the right and the fields to their left', width: 1280, height: 640,
      tryIt: ['Try it in Arabic', demo('page=customer&skin=underline&locale=ar&dir=rtl')], docs: ['Languages, in the docs', '/look/'],
    },
    {
      id: 'words',
      no: 'Your app’s own words',
      title: 'Your translations, through your own translator',
      body: 'A page can carry its words in several languages, or your app can hand Fieldia its own translator, and the page speaks it, labels, help and choices alike.',
      ticks: ['A page’s own words in each language it keeps', 'Your app’s translator for the rest', 'Fieldia’s own words in four languages, or yours over them', 'The designer’s Translations tab for the page’s words'],
      shot: 'french.png', alt: 'The About you group of a sign-up in French: Nom complet, E-mail, Entreprise and Votre rôle', width: 968, height: 228,
      tryIt: ['Try it in French', demo('page=signup&skin=outlined&translate=fr')], docs: ['Languages, in the docs', '/look/'],
    },
  ],
  facts: {
    no: 'Kept right',
    title: 'A look that is never at the reader’s cost',
    items: [
      ['AA, every theme', 'Every pair of colours a reader reads is checked at WCAG AA, light and dark.'],
      ['Your colours win', 'A host’s own tokens or stylesheet rule win over the skin, the theme and the scheme, whole.'],
      ['Scoped to the form', 'Fieldia’s styles stay inside its forms; your page around them is untouched.'],
      ['Small', 'Each language is its own add-on of about four kilobytes.'],
    ],
  },
  factLinks: [['Looks and languages, in the docs', '/look/'], ['Accessibility', '/accessibility/']],
  finale: { title: 'Dress your first page in your product’s colours', words: 'Pick a theme, add your accent, and hand the viewer your tokens when your app turns dark.' },
});
