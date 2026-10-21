import { fill, isEmpty, type DataSource, type Form, type Line, type Locale, type Page, type RecordTemplate, type Values } from '@fieldia/core';
import type { PreferenceStore, WidgetDialogs } from '@fieldia/widgets';
import type { El } from './dom';
import type { ViewerLabels } from './labels';

/** A value's own copy: plain JSON. */
const structuredCopy = <T>(value: T): T => (value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T));

/**
 * Record templates people save and name (`templates` on a record's page): "Botox package", "Standard lease" — a
 * record's values kept by a name, and a new record started from one. A Templates menu over the record: each template
 * to start a new record from, Save as template… (its name asked in a dialog; a name already kept is replaced), and
 * Delete templates…. Kept by the data source's `templates`, `saveTemplate` and `deleteTemplate` where it has them —
 * shared as the app shares them — else in the viewer's `preferences`, this person's own.
 *
 * What a template keeps: the page's `templates.fields`, else every field a person fills in — never the record's name
 * (its sheet's title), a file, a value worked out or locked — and of those, only what holds a value. A table's lines
 * are kept without their ids, new lines of the record started from it. Started from, its values are the person's own
 * changes: the page's change steps run, and Ctrl+Z takes each back.
 */

export interface TemplatesContext {
  doc: Document;
  el: El;
  form: Form;
  page: Page;
  labels: ViewerLabels;
  locale: Locale;
  preferences: PreferenceStore;
  dataSource: DataSource | undefined;
  say(message: string, tone: 'info' | 'success' | 'warning' | 'danger'): void;
  /** Values asked in a dialog (the widgets' `editValues`): the name a template is kept as, the templates to let go. */
  ask: WidgetDialogs['editValues'];
}

/** The fields a page's template keeps: its own list, else every field a person fills in but the record's name. */
export function templateFields(page: Page): string[] {
  const own = page.templates && page.templates !== true ? page.templates.fields : null;
  const title = page.layout.type === 'sheet' ? page.layout.title?.field : undefined;
  return Object.entries(page.fields)
    .filter(([name, def]) => (own ? own.includes(name) : name !== title && !def.readonly && !('compute' in def && def.compute) && def.type !== 'binary' && def.type !== 'image'))
    .map(([name]) => name);
}

/** What a template keeps of a record's values: its fields that hold a value, a table's lines without their ids. */
export function templateValues(page: Page, values: Readonly<Values>, hidden: readonly string[] = []): Values {
  const kept: Values = {};
  for (const name of templateFields(page)) {
    const def = page.fields[name];
    if (hidden.includes(name) || isEmpty(def, values[name])) continue;
    kept[name] = (def.type === 'one2many' ? ((values[name] as Line[] | null) ?? []).map((line) => ({ values: structuredCopy(line.values) })) : structuredCopy(values[name])) as Values[string];
  }
  return kept;
}

/** Where a page's templates are kept: the source's members, else the person's preferences. */
function keeper(context: TemplatesContext) {
  const { page, dataSource: source, preferences } = context;
  const request = { model: (page.data as { model: string }).model, pageId: page.id };
  const key = `templates:${page.id}`;
  const stored = (): RecordTemplate[] => {
    const kept = preferences.get(key);
    return Array.isArray(kept) ? (kept as unknown as RecordTemplate[]) : [];
  };
  const server = !!(source?.templates && source.saveTemplate && source.deleteTemplate);
  return {
    list: (): Promise<RecordTemplate[]> => (server ? (source as Required<DataSource>).templates(request) : Promise.resolve(stored())),
    async save(name: string, values: Values, id?: RecordTemplate['id']): Promise<RecordTemplate> {
      if (server) return (source as Required<DataSource>).saveTemplate({ ...request, template: { ...(id !== undefined ? { id } : {}), name, values } });
      const all = stored();
      const kept: RecordTemplate = { id: id ?? `t${Date.now().toString(36)}`, name, values };
      const at = all.findIndex((one) => String(one.id) === String(kept.id));
      preferences.set(key, (at >= 0 ? all.map((one, i) => (i === at ? kept : one)) : [...all, kept]) as never);
      return kept;
    },
    async remove(id: RecordTemplate['id']): Promise<void> {
      if (server) return (source as Required<DataSource>).deleteTemplate({ ...request, id });
      preferences.set(key, stored().filter((one) => String(one.id) !== String(id)) as never);
    },
  };
}

/** A template's values laid on the record shown, as the person's own changes: each field, a table's lines as new ones. */
export function startFrom(form: Form, template: RecordTemplate): string[] {
  const laid: string[] = [];
  let n = 0;
  for (const [name, value] of Object.entries(template.values)) {
    const def = form.page.fields[name];
    if (!def || form.fieldReadonly(name)) continue;
    const written = def.type === 'one2many' ? ((value as { values: Values }[] | null) ?? []).map((line) => ({ key: `new-t${++n}`, values: structuredCopy(line.values) })) : structuredCopy(value);
    form.setValue(name, written as Values[string]);
    form.boxLeft(name);
    laid.push(name);
  }
  return laid;
}

/** The Templates menu over a record: start from one, save one, let some go. */
export function templatesMenu(context: TemplatesContext): { element: HTMLElement; update(): void } | undefined {
  const { doc, el, form, page, labels } = context;
  // A page without them, shown where another's brought the part: none.
  if (!page.templates) return undefined;
  const kept = keeper(context);
  const id = `fd-templates-${++menus}`;
  const button = el('button', { type: 'button', class: 'fd-button fd-record-gear fd-templates-button', id: `${id}-button`, 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-controls': id }, labels.templatesButton);
  const menu = el('div', { class: 'fd-record-menu fd-templates-menu', role: 'menu', id, 'aria-labelledby': button.id, hidden: '' });
  const wrap = el('div', { class: 'fd-record-actions fd-templates' }, button, menu);
  let known: RecordTemplate[] = [];

  const item = (words: string, run: () => void, extra: Record<string, string> = {}) => {
    const one = el('button', { type: 'button', role: 'menuitem', tabindex: '-1', class: 'fd-record-menu-item', ...extra }, words);
    one.addEventListener('click', () => {
      close(true);
      run();
    });
    return one;
  };
  const items = () => [...menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];

  async function draw(): Promise<void> {
    known = await kept.list().catch(() => known);
    const isNew = form.getState().recordId == null;
    const starts = isNew && known.length ? [el('div', { role: 'group', 'aria-label': labels.templatesStart }, el('div', { class: 'fd-record-menu-heading', role: 'presentation' }, labels.templatesStart), ...known.map((one) => item(one.name, () => use(one), { 'data-template': String(one.id) })))] : [];
    menu.replaceChildren(...starts, ...(starts.length ? [el('div', { class: 'fd-record-menu-rule', role: 'separator' })] : []), item(labels.templateSave, () => void save()), ...(known.length ? [item(labels.templatesDelete, () => void letGo())] : []));
  }
  function use(template: RecordTemplate) {
    startFrom(form, template);
    context.say(fill(labels.templateUsed, { name: template.name }), 'info');
  }
  async function save() {
    const values = templateValues(page, form.getState().values, form.getState().can?.hiddenFields ?? []);
    const asked = await context.ask({
      title: labels.templateSave,
      values: { name: '' },
      fields: { name: { type: 'char', label: labels.templateName, required: true } },
      layout: [{ type: 'text', id: 'what', text: labels.templateKeeps, style: 'help' }, { type: 'field', id: 'f-name', field: 'name' }],
      buttons: { done: labels.templateKeep },
    });
    const name = String(asked?.['name'] ?? '').trim();
    if (!name) return;
    known = await kept.list().catch(() => known);
    const same = known.find((one) => one.name.trim().toLowerCase() === name.toLowerCase());
    try {
      await kept.save(name, values, same?.id);
      context.say(fill(same ? labels.templateReplaced : labels.templateSaved, { name }), 'success');
    } catch (error) {
      context.say(error instanceof Error ? error.message : String(error), 'danger');
    }
  }
  async function letGo() {
    known = await kept.list().catch(() => known);
    const asked = await context.ask({
      title: labels.templatesDelete,
      values: { gone: [] },
      fields: { gone: { type: 'selection', label: labels.templatesChosen, multiple: true, required: true, options: known.map((one) => ({ value: String(one.id), label: one.name })) } },
      layout: [{ type: 'field', id: 'f-gone', field: 'gone', widget: 'checkboxes' }],
      buttons: { done: labels.templatesDeleteNow },
    });
    const gone = (asked?.['gone'] as string[] | null) ?? [];
    if (!gone.length) return;
    try {
      for (const one of gone) await kept.remove(known.find((t) => String(t.id) === one)?.id ?? one);
      context.say(fill(labels.templatesDeleted, { n: gone.length }), 'success');
    } catch (error) {
      context.say(error instanceof Error ? error.message : String(error), 'danger');
    }
  }

  const onOutside = (event: Event) => {
    if (!wrap.contains(event.target as Node)) close(false);
  };
  async function open(at: 'first' | 'last') {
    if (!menu.hidden) return;
    await draw();
    menu.hidden = false;
    menu.removeAttribute('data-end');
    const box = menu.getBoundingClientRect();
    if (box.right > doc.documentElement.clientWidth - 4 || box.left < 4) menu.setAttribute('data-end', '');
    button.setAttribute('aria-expanded', 'true');
    doc.addEventListener('pointerdown', onOutside, true);
    const all = items();
    (at === 'first' ? all[0] : all[all.length - 1])?.focus();
  }
  function close(refocus: boolean) {
    if (menu.hidden) return;
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    doc.removeEventListener('pointerdown', onOutside, true);
    if (refocus) button.focus();
  }
  button.addEventListener('click', () => (menu.hidden ? void open('first') : close(false)));
  button.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    void open(event.key === 'ArrowDown' ? 'first' : 'last');
  });
  menu.addEventListener('keydown', (event) => {
    const all = items();
    const at = all.indexOf(doc.activeElement as HTMLButtonElement);
    const to = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: all.length - 1 }[event.key];
    if (to !== undefined) {
      event.preventDefault();
      all[(to + all.length) % all.length]?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === 'Tab') close(false);
  });
  // Saved and started from where the person may change the record: hidden where they may only read it.
  const update = () => {
    const may = form.getState().can?.edit !== false;
    if (wrap.hidden === may) wrap.hidden = !may;
  };
  return { element: wrap, update };
}

let menus = 0;
