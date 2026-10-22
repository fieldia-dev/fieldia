import { checkPage } from './check-page';
import type { Page } from './page';
import { validatePage } from './validate';

/** A customer's card filled from an e-mail signature, its notes with Draft and Polish. */
const customer = (more: Partial<Page> = {}, notes: Record<string, unknown> = { rewrite: ['draft', 'polish'] }): Page => ({
  fieldia: '0.10',
  id: 'customer',
  data: { kind: 'record', model: 'partner' },
  fields: {
    name: { type: 'char', label: 'Company' },
    email: { type: 'char', label: 'Email' },
    total: { type: 'monetary', label: 'Total', readonly: true },
    logo: { type: 'image', label: 'Logo' },
    notes: { type: 'text', label: 'Notes' },
    stage: { type: 'selection', label: 'Stage', options: [{ value: 'new', label: 'New' }] },
  },
  layout: {
    type: 'sheet',
    id: 'sheet',
    children: [
      { type: 'field', id: 'f-name', field: 'name' },
      { type: 'field', id: 'f-email', field: 'email' },
      { type: 'field', id: 'f-notes', field: 'notes', options: notes as never },
      { type: 'field', id: 'f-stage', field: 'stage' },
    ],
  },
  ...more,
});

const issues = (page: unknown) => {
  const checked = validatePage(page);
  return checked.ok ? [] : checked.issues.map((issue) => `${issue.path}: ${issue.message}`);
};

describe('AI help in the page format', () => {
  it('takes a Fill from text on a record’s page, its fields named or not, and Draft and Polish on a text field', () => {
    expect(issues(customer({ suggest: {} }))).toEqual([]);
    expect(issues(customer({ suggest: { fields: ['name', 'email'], from: ['text'], label: 'Fill from an e-mail', placeholder: 'Paste the signature' } }))).toEqual([]);
    expect(issues(customer({}, { rewrite: true }))).toEqual([]);
    expect(issues(customer({}, { rewrite: ['polish', { how: 'formal', label: 'More formal' }] }))).toEqual([]);
    expect(checkPage(customer({ suggest: {} })).ok).toBe(true);
  });

  it('refuses a field a proposal cannot fill, or one named twice, or one not on the page', () => {
    expect(issues(customer({ suggest: { fields: ['logo', 'total', 'name', 'name', 'nope'] } }))).toEqual([
      'suggest.fields[0]: "logo" is a image: a proposal fills words, numbers, money, yes or no, a choice, a day, links or a table of lines',
      'suggest.fields[1]: "total" is read-only: a proposal fills what a person can set',
      'suggest.fields[3]: "name" is named twice',
      'suggest.fields[4]: no field "nope"',
    ]);
  });

  it('refuses a photo set as it refuses a file, a list changed in place as any list, and fills a scanned text as any text', () => {
    // A photo set is a picture field's: no proposal fills it, as none fills a file or a logo.
    const photos = customer({ suggest: { fields: ['photos', 'name'] } });
    photos.fields['photos'] = { type: 'image', label: 'Photos', multiple: true };
    (photos.layout as { children: unknown[] }).children.push({ type: 'field', id: 'f-photos', field: 'photos', widget: 'photos' });
    expect(issues(photos)).toEqual(['suggest.fields[0]: "photos" is a image: a proposal fills words, numbers, money, yes or no, a choice, a day, links or a table of lines']);
    // A list whose cells change in place has no form for a proposal to fill: its rows are its records' own.
    const list = { ...customer({ suggest: {} }), layout: { type: 'list', id: 'list', columns: ['name', 'email'], editable: true } };
    expect(issues(list)).toEqual(['suggest: suggest fills a form’s fields; a list of records has none to fill: put it on the record’s page']);
    // A field scanned into with the camera is a text a proposal fills, and its tools stay beside the Scan button.
    const scanned = customer({ suggest: { fields: ['email', 'notes'] } }, { rewrite: ['polish'], scan: true });
    expect(issues(scanned)).toEqual([]);
  });

  it('reads a record’s own words where it says, a text of the page’s it does not fill', () => {
    expect(issues(customer({ suggest: { fromField: 'notes', fields: ['name'] } }))).toEqual([]);
    expect(issues(customer({ suggest: { fromField: 'stage' } }))).toEqual(['suggest.fromField: "stage" is a selection: the words read are a char, text or html field\'s']);
    expect(issues(customer({ suggest: { fromField: 'notes', fields: ['notes'] } }))).toEqual(['suggest.fromField: "notes" is what is read: it is not filled too']);
    expect(issues(customer({ suggest: { fromField: 'nope' } }))).toEqual(['suggest.fromField: no field "nope"']);
  });

  it('refuses a Fill from text on a list of records, and settings it does not know', () => {
    const list = { ...customer({ suggest: {} }), layout: { type: 'list', id: 'list', columns: ['name'] } } as Page;
    expect(issues(list)).toEqual(['suggest: suggest fills a form’s fields; a list of records has none to fill: put it on the record’s page']);
    expect(issues(customer({ suggest: { from: ['voice'] } as never }))[0]).toBe('suggest.from[0]: from is "text" (words pasted), "files", or both');
    expect(issues(customer({ suggest: { model: 'gpt' } as never }))[0]).toMatch(/^suggest/);
  });

  it('keeps a text field’s tools to text, each once, each the app’s own with its words', () => {
    const onStage = customer();
    (onStage.layout as { children: { options?: unknown }[] }).children[3].options = { rewrite: true };
    expect(issues(onStage)).toEqual(['layout.children[3].options.rewrite: rewrite is for a char, text or html field; "stage" is a selection']);
    expect(issues(customer({}, { rewrite: [] }))).toEqual(['layout.children[2].options.rewrite: rewrite is true, or a list of its tools: ["draft", "polish"], or { "how": "shorter", "label": "Shorter" }']);
    expect(issues(customer({}, { rewrite: ['draft', 'draft', { how: 'shorter' }, 'translate'] }))).toEqual([
      'layout.children[2].options.rewrite[1]: "draft" is given twice',
      'layout.children[2].options.rewrite[2]: a tool is "draft", "polish", or one of the app’s own: { "how": "shorter", "label": "Shorter" }',
      'layout.children[2].options.rewrite[3]: a tool is "draft", "polish", or one of the app’s own: { "how": "shorter", "label": "Shorter" }',
    ]);
  });

  it('takes a list’s words read as filters, on or off', () => {
    const list = (on: unknown) => ({ ...customer(), layout: { type: 'list', id: 'list', columns: ['name'], searchToFilter: on } }) as Page;
    expect(issues(list(true))).toEqual([]);
    expect(issues(list(false))).toEqual([]);
    expect(issues(list('yes'))[0]).toMatch(/^layout\.searchToFilter/);
  });
});
