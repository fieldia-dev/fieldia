import { demoHref as demo, featurePage } from '../feature-page.mjs';

/** A feature page: Forms and surveys. What a form people fill in has, each part from a real demo. */
export default featurePage({
  path: '/features/forms/',
  folder: 'forms',
  title: 'Forms and surveys',
  description: 'Forms and surveys with Fieldia: 19 field types and over 35 widgets, steps that follow the answers, checks as people type, and a Google Forms look, from one JSON page.',
  kicker: 'Forms and surveys',
  headline: ['Forms people finish.', 'Surveys that listen to the answers.'],
  lede: 'Sign-ups, applications, feedback, intake forms: every field a form needs, steps that skip what does not apply, and checks that say what is missing before anyone presses Send. This survey is live. Answer it.',
  opening: { frame: 'page=survey&skin=outlined', title: 'A live product survey, in steps' },
  parts: [
    {
      id: 'fields',
      no: 'Every field',
      title: 'The field each answer needs, already built',
      body: 'Nineteen field types and over thirty-five widgets, each drawn the way its value reads best and each tested by keyboard, in Arabic and in four frameworks.',
      ticks: ['Text, email, phone, links, passwords, tags and rich text', 'Numbers, money in its currency, percentages, durations, sliders and ratings', 'Dates, times and ranges; choices as lists, buttons, pictures or a ranking', 'Files and pictures, a signature, a matrix of answers, and your own widget'],
      shot: 'fields.png', alt: 'A form of every field: a project name, an email, a phone, a portal link, a password, material tags, a scope of work and a rich-text design brief', width: 1280, height: 860,
      tryIt: ['Try every field', demo('page=fields&skin=outlined')], docs: ['Fields, in the docs', '/fields/'],
    },
    {
      id: 'steps',
      no: 'Steps that follow the answers',
      title: 'A long form, one short step at a time',
      body: 'Split a form into steps with a progress bar. A step can be optional, or shown only when an earlier answer calls for it, so nobody is asked about a product they never used.',
      ticks: ['Steps with their own names and icons, and a bar that says how far along', 'A step shown only when an answer calls for it', 'Each step checked before the next; done steps ticked, and clickable', 'Your own words for Next, Back and the last button'],
      shot: 'steps.png', alt: 'Step 3 of 4 of a product survey: two steps ticked, a five-star rating, a grid of how easy each part was, and checkboxes', width: 1000, height: 700,
      tryIt: ['Try the survey', demo('page=survey&skin=outlined')], docs: ['Pages and steps, in the docs', '/pages/'],
    },
    {
      id: 'checks',
      no: 'Checked as people type',
      title: 'What is missing, said where it is missing',
      body: 'Required fields, lengths, patterns and ranges are checked as people type and again when they send. Each problem shows under its field, in the reader’s language, and the cursor goes to the first.',
      ticks: ['Required, length, pattern, minimum and maximum, from the page', 'An email checked as an email, a phone as a phone', 'Problems said under their fields and to screen readers', 'Optionally, a tick on each field filled in right'],
      shot: 'checks.png', alt: 'A workshop sign-up after Send: Full name is required, Enter an email address, Your role is required, each in red under its field', width: 1000, height: 1000,
      tryIt: ['Try the sign-up', demo('page=signup&skin=outlined')], docs: ['Behaviour, in the docs', '/behaviour/'],
    },
    {
      id: 'google',
      no: 'Looks people know',
      title: 'A survey that looks like Google Forms, or like your product',
      body: 'The same page in the Google Forms look: a title card with a band of colour and a card for each question. Or Material, Fluent, Apple and five more, light or dark.',
      ticks: ['A title card, and a card for each question', 'Eight themes, each one line in the page', 'Your own accent, font, spacing and corners over any of them', 'Eleven survey templates to start from'],
      shot: 'google.png', alt: 'A customer feedback survey in the Google Forms look: a purple band over the title card, then a card for each question with stars, a 0 to 10 scale and checkboxes', width: 1000, height: 720,
      tryIt: ['See the templates', '/templates/'], docs: ['Themes, in the docs', '/look/'],
    },
  ],
  facts: {
    no: 'Kept right',
    title: 'What a form needs to be finished',
    items: [
      ['Nothing lost', 'With a draft store, an unfinished form keeps its answers when the person leaves and comes back.'],
      ['Every reader', 'WCAG 2.2 AA, every field by keyboard, and every problem said to a screen reader.'],
      ['Any language', 'English, Arabic, German and French built in, right to left in full, and your own words.'],
      ['Answers to you', 'One call hands you the answers as JSON, checked, for your server or anywhere.'],
    ],
  },
  factLinks: [['Accessibility', '/accessibility/'], ['Your backend, in the docs', '/data/']],
  finale: { title: 'Put your first form on a page in five minutes', words: 'One script tag and a page of JSON, or a package for your framework.' },
});
