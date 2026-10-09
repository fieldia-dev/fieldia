import { demoHref as demo, featurePage } from '../feature-page.mjs';

/** A feature page: Lists and search. How people find records, and act on several at once. */
export default featurePage({
  path: '/features/lists/',
  folder: 'lists',
  title: 'Lists and search',
  description: 'Lists and search with Fieldia: a search bar with suggestions, filters, grouping and favourites, sorting and pages, and buttons for the records chosen, from one JSON page.',
  kicker: 'Lists and search',
  headline: ['Find the record.', 'Then act on ten at once.'],
  lede: 'A list of records with a search bar that suggests as people type, filters and groupings they can keep, and buttons for the rows they choose. Your server answers each search. This list is live. Search it.',
  opening: { frame: 'page=customers&skin=underline', title: 'A live list of customers, with its search bar' },
  parts: [
    {
      id: 'search',
      no: 'Search as people type',
      title: 'A search bar that knows what can be searched',
      body: 'Type a few letters and the bar offers each field it can search, by name. Pick one with the arrow keys, or narrow further, and the list follows.',
      ticks: ['A suggestion for each searchable field, picked by keyboard or mouse', 'Several searches at once, each a chip that can be taken off', 'Your server gets the whole search, as filters it can translate', 'Slow answers that arrive after newer ones are ignored'],
      shot: 'suggest.png', alt: 'A customer list with egy typed in the search bar, offering Search Name, Email, Phone or Country for egy', width: 1280, height: 560,
      tryIt: ['Try the list', demo('page=customers&skin=underline')], docs: ['Lists and search, in the docs', '/lists/'],
    },
    {
      id: 'group',
      no: 'Filters, groups and favourites',
      title: 'The same records, seen the way each person needs',
      body: 'Filters and groupings from the page’s own menu, sorting by any column, and favourites saved by name, one of them opened by default.',
      ticks: ['Filters and group-bys the page names, combined freely', 'Groups that open and close, with their counts', 'Sort by any column, both ways; pages of rows', 'Favourites kept, one used by default'],
      shot: 'group.png', alt: 'The customer list grouped by Country: Egypt (10) open, Jordan and Saudi Arabia closed', width: 1280, height: 720,
      tryIt: ['Try the list', demo('page=customers&skin=underline')], docs: ['Lists and search, in the docs', '/lists/'],
    },
    {
      id: 'chosen',
      no: 'Buttons for the records chosen',
      title: 'Tick the rows, then press one button',
      body: 'Rows have ticks; choosing some brings a bar of the buttons that apply to them, such as Archive or Send statement, each asking first when the page says so.',
      ticks: ['A bar of buttons for the chosen rows, and how many', 'Ask before acting, then your app gets their ids', 'A row opens its record on its own page', 'Columns sized to their values, numbers lined up'],
      shot: 'chosen.png', alt: 'Two customers ticked, Delta Foods and Giza Plaza, and a bar saying 2 selected with Send statement, Archive and Clear', width: 1280, height: 600,
      tryIt: ['Try the list', demo('page=customers&skin=underline')], docs: ['Lists and search, in the docs', '/lists/'],
    },
    {
      id: 'arabic',
      no: 'In any language',
      title: 'Right to left, from the search bar to the last column',
      body: 'The same list in Arabic: columns, chips, buttons and pages turned to read right to left, with numbers and money written the reader’s way.',
      ticks: ['English, Arabic, German and French built in', 'Right to left in full, never only the words', 'Numbers, dates and money in the reader’s way', 'Your app’s own words through its translator'],
      shot: 'arabic.png', alt: 'The customer list in Arabic, right to left: the search bar, the column titles and the rows reading from the right', width: 1280, height: 600,
      tryIt: ['Try it in Arabic', demo('page=customers&skin=underline&locale=ar&dir=rtl')], docs: ['Languages, in the docs', '/look/'],
    },
  ],
  facts: {
    no: 'Kept right',
    title: 'What a list needs at scale',
    items: [
      ['Your server pages', 'Only the rows shown are asked for, with the search, sort and grouping your server applies.'],
      ['Every reader', 'A real table for screen readers, every control by keyboard, AA contrast.'],
      ['Kept between visits', 'Favourites and chosen columns are remembered for the person.'],
      ['One page', 'The list is a page of JSON like a form, its rows opening the record’s page.'],
    ],
  },
  factLinks: [['Lists and search, in the docs', '/lists/'], ['Your backend, in the docs', '/data/']],
  finale: { title: 'Give your records a list in an afternoon', words: 'Name the columns, filters and groupings in the page, and answer one list request from your server.' },
});
