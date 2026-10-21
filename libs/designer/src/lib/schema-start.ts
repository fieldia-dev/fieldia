import { pageFromSchema, schemaChoices, SchemaRefused, type FieldNode, type Page, type PageFromSchema } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { kindById, kindName, kindOfField } from './kinds';
import { setHidden, setText } from './writes';

/**
 * "Start from a schema…", on a blank page beside Start blank and in Find anything: a dialog where a person pastes a
 * JSON Schema, an OpenAPI document or a model's fields — or chooses its file — and sees, before anything changes, the
 * fields it makes with their kinds, what is kept with a change and what is left out (`pageFromSchema`). An OpenAPI
 * document says which of its operations and schemas to start from. Start puts the page in place as one edit, said
 * with Undo; Cancel, Escape, the × or a click outside leave the page as it was. Start shows only once there is a page
 * to start with.
 */

export interface SchemaDialogOptions {
  el: ElementFactory;
  /** Where the dialog opens: the editor's own element. */
  root: HTMLElement;
  designer: Designer;
  /** A survey's questions and steps, or a screen's fields and sections. */
  survey: boolean;
  /** The page put in place, with how many fields it has: for the editor to say, with Undo. */
  onStarted(page: Page, fields: number): void;
}

let made = 0;

export function openSchemaDialog(options: SchemaDialogOptions): { close(): void } {
  const { el, root, designer, survey } = options;
  const doc = root.ownerDocument;
  const opener = doc.activeElement as HTMLElement | null;
  const w = designer.words.templates.schema;
  const id = `fd-schema-dialog-${++made}`;
  const text = el('textarea', { class: 'fd-input fd-schema-text', id: `${id}-text`, rows: '8', spellcheck: 'false', autocomplete: 'off', dir: 'ltr', placeholder: '{ "type": "object", "properties": { … } }' });
  const picker = el('input', { type: 'file', accept: '.json,application/json', hidden: '', tabindex: '-1', 'aria-hidden': 'true' });
  const file = el('button', { type: 'button', class: 'fd-button' }, w.file);
  const choice = el('select', { class: 'fd-input fd-schema-choice', id: `${id}-choice` });
  const choiceRow = el('div', { class: 'fd-schema-row', hidden: '' }, el('label', { class: 'fd-schema-label', for: choice.id }, w.from), choice);
  const problem = el('p', { class: 'fd-schema-problem', role: 'alert', hidden: '' });
  const count = el('p', { class: 'fd-schema-count' });
  const fields = el('ul', { class: 'fd-schema-fields' });
  const keptHead = el('p', { class: 'fd-schema-said' }, w.kept);
  const kept = el('ul', { class: 'fd-schema-notes' });
  const leftHead = el('p', { class: 'fd-schema-said' }, w.leftOut);
  const left = el('ul', { class: 'fd-schema-notes' });
  const preview = el('div', { class: 'fd-schema-preview', role: 'status', hidden: '' }, count, fields, keptHead, kept, leftHead, left);
  const start = el('button', { type: 'button', class: 'fd-button fd-button-primary', hidden: '' }, w.start);
  const cancel = el('button', { type: 'button', class: 'fd-button' }, w.cancel);
  const closeX = el('button', { type: 'button', class: 'fd-dialog-close', 'aria-label': w.close }, '×');
  const dialog = el(
    'div',
    { class: 'fd-form-dialog fd-size-medium fd-schema-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': `${id}-title`, 'aria-describedby': `${id}-lead`, tabindex: '-1' },
    el('div', { class: 'fd-form-dialog-head' }, el('h2', { class: 'fd-form-dialog-title', id: `${id}-title` }, w.title), closeX),
    el(
      'div',
      { class: 'fd-schema-body' },
      el('p', { class: 'fd-schema-lead', id: `${id}-lead` }, w.lead(survey)),
      el('label', { class: 'fd-schema-label', for: text.id }, w.label),
      text,
      el('div', { class: 'fd-schema-row' }, file, picker),
      choiceRow,
      problem,
      preview,
      el('div', { class: 'fd-schema-actions' }, start, cancel)
    )
  );
  const backdrop = el('div', { class: 'fd-dialog-backdrop fd-schema-backdrop' }, dialog);

  /** What the schema makes now: the page and what was said, or why there is none. */
  let read: PageFromSchema | null = null;
  let choicesFor = '';
  function readNow() {
    read = null;
    const typed = text.value.trim();
    let said = '';
    let parsed: unknown = undefined;
    if (typed) {
      try {
        parsed = JSON.parse(typed);
      } catch (error) {
        said = w.notJson((error as Error).message);
      }
    }
    // An OpenAPI document's operations and schemas, offered once for each document.
    const choices = parsed === undefined ? [] : schemaChoices(parsed);
    const key = JSON.stringify(choices);
    if (key !== choicesFor) {
      choicesFor = key;
      choice.replaceChildren(...choices.map((one) => el('option', { value: one.value }, one.label)));
    }
    setHidden(choiceRow, !choices.length);
    if (parsed !== undefined && !said) {
      try {
        read = pageFromSchema(parsed, { kind: survey ? 'survey' : 'screen', ...(choices.length ? { schema: choice.value } : {}) });
      } catch (error) {
        said = error instanceof SchemaRefused ? w.refused[error.code] : (error as Error).message;
      }
    }
    setText(problem, said);
    setHidden(problem, !said);
    setHidden(preview, !read);
    setHidden(start, !read);
    if (!read) return;
    const page = read.page;
    const nodes = fieldNodes(page.layout);
    setText(count, w.fields(nodes.length, survey));
    fields.replaceChildren(
      ...nodes.map((node) => {
        const field = page.fields[node.field];
        const kind = kindOfField(field, node);
        return el('li', {}, el('bdi', { class: 'fd-schema-field' }, field.label), ' ', el('span', { class: 'fd-schema-kind' }, kind ? kindName(kindById(kind), designer.words) : ((designer.words.kinds.stored as Record<string, string>)[field.type] ?? field.type)));
      })
    );
    const listed = (notes: PageFromSchema['notes']) => notes.map((note) => el('li', {}, el('bdi', {}, w.note(note.code, note.path || '—', note.detail ?? ''))));
    kept.replaceChildren(...listed(read.notes));
    left.replaceChildren(...listed(read.unmapped));
    for (const [head, list] of [[keptHead, kept], [leftHead, left]] as const) {
      setHidden(head, !list.children.length);
      setHidden(list, !list.children.length);
    }
  }

  function close(refocus = true) {
    if (!backdrop.isConnected) return;
    backdrop.remove();
    if (refocus) opener?.focus?.();
  }
  text.addEventListener('input', readNow);
  choice.addEventListener('change', readNow);
  file.addEventListener('click', () => picker.click());
  picker.addEventListener('change', () => {
    const chosen = picker.files?.[0];
    if (!chosen) return;
    void chosen.text().then((content) => {
      text.value = content;
      picker.value = '';
      readNow();
      text.focus();
    });
  });
  start.addEventListener('click', () => {
    if (!read) return;
    const page = read.page;
    const n = fieldNodes(page.layout).length;
    if (!designer.replacePage(page)) return;
    close(false);
    options.onStarted(page, n);
  });
  for (const button of [cancel, closeX]) button.addEventListener('click', () => close());
  backdrop.addEventListener('pointerdown', (event) => event.target === backdrop && close());
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'Tab') {
      // The keyboard stays in the dialog.
      const stops = [...dialog.querySelectorAll<HTMLElement>('button, textarea, select')].filter((e) => !e.closest('[hidden]'));
      const [first, last] = [stops[0], stops[stops.length - 1]];
      if (event.shiftKey && doc.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && doc.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  });
  root.append(backdrop);
  text.focus();
  return { close };
}

/** The fields a page shows, in order. */
function fieldNodes(layout: Page['layout']): FieldNode[] {
  const walk = (nodes: unknown[]): FieldNode[] =>
    nodes.flatMap((node) => {
      const one = node as { type: string; children?: unknown[] };
      return one.type === 'field' ? [one as FieldNode] : Array.isArray(one.children) ? walk(one.children) : [];
    });
  return 'children' in layout && Array.isArray(layout.children) ? walk(layout.children as unknown[]) : [];
}
