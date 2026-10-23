import type { Page } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { mountScreenEditor, type ScreenEditorHandle } from './screen-editor';
import { mountSurveyEditor, type SurveyEditorHandle } from './survey-editor';

/**
 * "Start from a schema…" on a blank page: a dialog to paste a JSON Schema, an OpenAPI document or a model's fields, which
 * shows the fields it makes with their kinds, what is kept with a change and what is left out. Start puts the page in
 * place as one edit, said with Undo; pressed with nothing to start from, it says what to do.
 */

let handle: ScreenEditorHandle | SurveyEditorHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

function mount(kind: 'screen' | 'survey' = 'screen') {
  const designer = createDesigner({ page: blankPage(kind, 'Enquiry') });
  const root = document.createElement('div');
  document.body.append(root);
  handle = kind === 'screen' ? mountScreenEditor(root, { designer }) : mountSurveyEditor(root, { designer });
  return { root, designer };
}

const shown = (element: Element | null | undefined) => !!element && !element.closest('[hidden]');
const button = (scope: Element, name: string) => [...scope.querySelectorAll<HTMLButtonElement>('button')].find((b) => shown(b) && (b.getAttribute('aria-label') ?? b.textContent?.trim()) === name);
const dialog = () => document.querySelector<HTMLElement>('.fd-schema-dialog') as HTMLElement;
function paste(json: unknown) {
  const text = dialog().querySelector('textarea') as HTMLTextAreaElement;
  text.value = typeof json === 'string' ? json : JSON.stringify(json);
  text.dispatchEvent(new Event('input', { bubbles: true }));
}
const words = (element: Element | null) => (element?.textContent ?? '').replace(/\s+/g, ' ').trim();

const schema = {
  title: 'Property enquiry',
  type: 'object',
  required: ['name'],
  properties: {
    name: { type: 'string', title: 'Client' },
    email: { type: 'string', format: 'email' },
    kind: { type: 'string', enum: ['villa', 'apartment'] },
    tags: { type: 'array', items: { type: 'string' } },
    owner: { $ref: 'https://example.com/owner.json' },
  },
};

describe('starting from a schema', () => {
  it('shows what the schema makes before anything changes, then starts from it as one edit, with Undo', () => {
    const { root, designer } = mount();
    const offer = button(root, 'Start from a schema…') as HTMLButtonElement;
    expect(offer).toBeDefined();
    offer.click();
    expect(shown(dialog())).toBe(true);
    expect(dialog().getAttribute('role')).toBe('dialog');
    expect(words(dialog().querySelector('.fd-form-dialog-title'))).toBe('Start from a schema');
    // Start pressed with nothing to start from says what to do, the focus in the box; typing takes the words away.
    (button(dialog(), 'Start') as HTMLButtonElement).click();
    expect(shown(dialog())).toBe(true);
    expect(words(dialog().querySelector('.fd-schema-problem'))).toBe('Paste a schema or choose a file first.');
    expect(shown(dialog().querySelector('.fd-schema-problem'))).toBe(true);
    expect(document.activeElement).toBe(dialog().querySelector('textarea'));

    paste('{ "type": ');
    expect(words(dialog().querySelector('.fd-schema-problem'))).toMatch(/^This is not JSON:/);
    // Pressed on what does not read: its problem stays said, nothing starts.
    (button(dialog(), 'Start') as HTMLButtonElement).click();
    expect(words(dialog().querySelector('.fd-schema-problem'))).toMatch(/^This is not JSON:/);
    expect(Object.keys(designer.getPage().fields)).toEqual([]);

    paste(schema);
    expect(shown(dialog().querySelector('.fd-schema-problem'))).toBe(false);
    expect(words(dialog().querySelector('.fd-schema-count'))).toBe('4 fields:');
    expect([...dialog().querySelectorAll('.fd-schema-field')].map(words)).toEqual(['Client', 'Email', 'Kind', 'Tags']);
    expect(words(dialog().querySelectorAll('.fd-schema-notes')[0])).toBe('tags is kept as JSON, edited as text: no field holds a list of text.');
    expect(words(dialog().querySelectorAll('.fd-schema-notes')[1])).toBe('owner refers to https://example.com/owner.json, which is not in the document.');
    // The page is as it was until Start.
    expect(Object.keys(designer.getPage().fields)).toEqual([]);

    (button(dialog(), 'Start') as HTMLButtonElement).click();
    expect(document.querySelector('.fd-schema-dialog')).toBeNull();
    expect(Object.keys(designer.getPage().fields)).toEqual(['name', 'email', 'kind', 'tags']);
    expect(designer.getPage().fields['name']).toEqual({ type: 'char', label: 'Client', required: true });
    const said = root.querySelector('.fd-start-done') as HTMLElement;
    expect(shown(said)).toBe(true);
    expect(words(said.querySelector('.fd-start-done-words'))).toBe('Started from the schema: 4 fields.');
    (button(said, 'Undo') as HTMLButtonElement).click();
    expect(Object.keys(designer.getPage().fields)).toEqual([]);
  });

  it("offers an OpenAPI document's operations and schemas, and starts a survey's questions from the one chosen", () => {
    const { root, designer } = mount('survey');
    (button(root, 'Start from a schema…') as HTMLButtonElement).click();
    paste({
      openapi: '3.1.0',
      paths: { '/enquiries': { post: { summary: 'Send an enquiry', requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Enquiry' } } } } } } },
      components: { schemas: { Enquiry: { type: 'object', properties: { name: { type: 'string' }, budget: { type: 'number' } } }, Agent: { type: 'object', properties: { phone: { type: 'string' } } } } },
    });
    const choice = dialog().querySelector('select') as HTMLSelectElement;
    expect(shown(choice)).toBe(true);
    expect([...choice.options].map((option) => option.textContent)).toEqual(['POST /enquiries — Send an enquiry', 'Enquiry', 'Agent']);
    expect(words(dialog().querySelector('.fd-schema-count'))).toBe('2 questions:');
    choice.value = 'Agent';
    choice.dispatchEvent(new Event('change', { bubbles: true }));
    expect([...dialog().querySelectorAll('.fd-schema-field')].map(words)).toEqual(['Phone']);
    (button(dialog(), 'Start') as HTMLButtonElement).click();
    const page: Page = designer.getPage();
    expect(page.layout.type).toBe('wizard');
    expect(Object.keys(page.fields)).toEqual(['phone']);
  });

  it('says why a schema gives no page, in the designer’s words, and Cancel leaves the page as it was', () => {
    const { root, designer } = mount();
    (button(root, 'Start from a schema…') as HTMLButtonElement).click();
    paste({ type: 'string' });
    expect(words(dialog().querySelector('.fd-schema-problem'))).toBe('This is not a JSON Schema, an OpenAPI document or a model’s fields: it has no properties, no paths and no fields with a type.');
    (button(dialog(), 'Cancel') as HTMLButtonElement).click();
    expect(document.querySelector('.fd-schema-dialog')).toBeNull();
    expect(Object.keys(designer.getPage().fields)).toEqual([]);
  });

  it('is in Find anything while the page is blank', () => {
    mount();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true }));
    const item = [...document.querySelectorAll<HTMLElement>('.fd-find-option')].find((option) => option.querySelector('.fd-find-label')?.textContent === 'Start from a schema…');
    expect(item).toBeDefined();
    item?.click();
    expect(shown(dialog())).toBe(true);
  });
});
