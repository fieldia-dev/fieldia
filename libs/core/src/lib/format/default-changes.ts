/**
 * What a page does by default that changed between formats, with the setting that keeps the way it was (the audit's
 * R-M8). These came before the release train (docs/maintainers/release-train.md) made a changed default a new format
 * whose step writes the old default into an older page (`PageUpgrade.uses`): a page written before them does what the
 * newer Fieldia does, and the setting here keeps the old way. The format's docs list them from here (site/pages/
 * format.mjs), and default-changes.spec.ts holds each setting to the format: it is one, it came by then, and the page
 * that says it reads.
 *
 * Plain data, read as it is by the docs' build (its types left out).
 */

/** One default that changed, and how a page keeps the old one. */
export interface DefaultChange {
  /** The format it changed in, and the Fieldia that brought it. */
  format: string;
  release: string;
  /** What a page does now, and did before. */
  now: string;
  before: string;
  /** What to write to keep the old way, in words — none where nothing does (`keep: null`). */
  keep: string | null;
  /** A page that keeps the old way, as small as it can be: checked to read. */
  example: Record<string, unknown> | null;
}

const field = (type: string, more: Record<string, unknown> = {}) => ({ fieldia: '0.13', id: 'kept', data: { kind: 'responses' }, fields: { x: { type, label: 'X' } }, layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-x', field: 'x', ...more }] } });

export const DEFAULT_CHANGES: readonly DefaultChange[] = [
  {
    format: '0.6',
    release: '0.27',
    now: 'A choice its list no longer offers after a change is taken out of the answer, and said ("Garden is no longer offered, so it was taken out").',
    before: 'It was kept, and sent.',
    keep: null,
    example: null,
  },
  {
    format: '0.7',
    release: '0.28',
    now: 'A table of lines is drawn as cards on a phone.',
    before: 'Its rows kept the table at a phone\'s width.',
    keep: 'On the table\'s node, "cards": "never".',
    example: { ...field('one2many', { cards: 'never' }), fields: { x: { type: 'one2many', label: 'Lines', relation: 'line', fields: { name: { type: 'char', label: 'Name' } } } } },
  },
  {
    format: '0.10',
    release: '0.31',
    now: 'A week starts where its reader is: the page\'s own region, else the reader\'s, else the region its language is most spoken in.',
    before: 'Saturday for Arabic, Monday for every other language.',
    keep: 'Name the page\'s region in its language ("language": "en-GB" starts on Monday), or give a list\'s calendar its first day ("firstDay": 1).',
    example: { ...field('char'), language: 'en-GB' },
  },
  {
    format: '0.11',
    release: '0.32',
    now: 'A phone\'s country is picked from Fieldia\'s own list, found by typing.',
    before: 'From the browser\'s own list.',
    keep: 'On the page, "phone": { "countries": "native" }; on one phone field\'s node, "options": { "countries": "native" }.',
    example: { ...field('char', { widget: 'phone', options: { countries: 'native' } }), phone: { countries: 'native' } },
  },
];
