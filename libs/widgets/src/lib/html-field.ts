import type { JsonValue } from '@fieldia/core';
import { decorateLinks, formattedText, type TextReference } from './formatted-text';
import { drawIcon } from './icons';
import { fillIn, maker, setAttr } from './kind-parts';
import { WIDGET_LABELS } from './labels';
import { sanitizeHtml } from './sanitize';
import { TEXT_TOOLS, type TextTool } from './text-tools';
import type { Widget, WidgetContext } from './widgets';

/**
 * A formatted text field drawn as a work item draws one. Its options:
 *
 *   toolbar      'always' (true), 'focus' — no edge and no toolbar at rest, a
 *                light box when pointed at, the accent box with the toolbar
 *                inside it while worked in — or 'never' (false)
 *   toolbarAt    'top' or 'bottom' (the foot unless said, with 'focus')
 *   tools        the tools, in order: bold … attach (text-tools.ts)
 *   editor       'rich', or 'markdown': at rest the text as it reads, its
 *                links opening in a tab of their own; a click on its words,
 *                Enter, or Edit in its group's heading opens the Markdown
 *                card; Done keeps what was typed, Escape puts back what it held
 *   switchEditor a link under it to the other editor
 *   mention      { model }: people @mentioned, found with form.search
 *   references   [{ key, model, label, icon }]: records linked by "#", "!" …
 *
 * Whichever the editor, the value is stored as clean HTML.
 */

/** Whether a page asks this field for more than the classic toolbar. */
export function usesEditor(options: Record<string, JsonValue> | undefined): boolean {
  if (!options) return false;
  return (
    options['toolbar'] === 'focus' ||
    options['toolbarAt'] !== undefined ||
    Array.isArray(options['tools']) ||
    options['editor'] !== undefined ||
    options['switchEditor'] === true ||
    options['mention'] !== undefined ||
    options['references'] !== undefined
  );
}

const isTool = (tool: unknown): tool is TextTool => typeof tool === 'string' && (TEXT_TOOLS as readonly string[]).includes(tool);
const record = (value: JsonValue | undefined): Record<string, JsonValue> | null => (value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null);

export function modernHtml(context: WidgetContext): Widget {
  const { form, name, node, id, document, labels = WIDGET_LABELS.en } = context;
  const make = maker(document);
  const options = node.options ?? {};
  const pageEditor = options['editor'] === 'markdown' ? 'markdown' : 'rich';
  const toolbar = options['toolbar'] === false || options['toolbar'] === 'never' ? 'never' : options['toolbar'] === 'focus' ? 'focus' : 'always';
  const tools = Array.isArray(options['tools']) ? options['tools'].filter(isTool) : undefined;
  const mention = record(options['mention']);
  const mentionModel = typeof mention?.['model'] === 'string' ? mention['model'] : null;
  const references: TextReference[] = (Array.isArray(options['references']) ? options['references'] : []).flatMap((given) => {
    const r = record(given);
    if (!r || typeof r['key'] !== 'string' || typeof r['model'] !== 'string' || typeof r['label'] !== 'string') return [];
    const model = r['model'];
    return [{ key: r['key'], label: r['label'], model, ...(typeof r['icon'] === 'string' ? { icon: r['icon'] } : {}), search: (query: string) => form.search(name, query, 8, { model }) }];
  });

  let editing = pageEditor === 'rich';
  let readonly = false;
  /** What the field held as editing began: Escape puts it back. */
  let before: string | null = null;

  const text = formattedText(document, {
    id: pageEditor === 'rich' ? id : `${id}-markdown`,
    labelledBy: `${id}-label`,
    placeholder: node.placeholder,
    labels,
    editor: pageEditor,
    tools,
    toolbar,
    ...(typeof options['toolbarAt'] === 'string' ? { toolbarAt: options['toolbarAt'] === 'top' ? 'top' : 'bottom' } : {}),
    switchEditor: options['switchEditor'] === true,
    ...(mentionModel ? { mention: { search: (query: string) => form.search(name, query, 8, { model: mentionModel }) } } : {}),
    references,
    onInput: (html) => form.setValue(name, html),
    onKey(event) {
      if (event.key !== 'Escape' || pageEditor !== 'markdown' || !editing) return false;
      event.preventDefault();
      event.stopPropagation();
      finish(false);
      return true;
    },
  });

  if (pageEditor === 'rich') {
    return {
      element: text.element,
      focus: () => text.focus(),
      destroy: () => text.destroy(),
      update(state) {
        readonly = state.readonly;
        text.setValue(typeof state.value === 'string' ? state.value : null);
        text.setReadonly(state.readonly);
        const box = text.input();
        setAttr(box, 'aria-invalid', String(state.invalid));
        setAttr(box, 'aria-describedby', state.describedBy || null);
      },
    };
  }

  // ---- Markdown: the text as it reads at rest, the card while it is edited ----
  const view = make('div', { class: 'fd-md-view', id, role: 'textbox', 'aria-multiline': 'true', 'aria-readonly': 'false', tabindex: '0', 'aria-labelledby': `${id}-label` });
  if (node.placeholder) view.setAttribute('data-placeholder', node.placeholder);
  const label = () => document.getElementById(`${id}-label`)?.textContent?.trim() || form.page.fields[name]?.label || name;
  const editButton = make('button', { type: 'button', class: 'fd-field-tool', 'data-tool': 'edit' });
  const doneButton = make('button', { type: 'button', class: 'fd-field-tool', 'data-tool': 'done', hidden: '' });
  const pencil = drawIcon(document, 'edit');
  const tick = drawIcon(document, 'check');
  if (pencil) editButton.append(pencil);
  if (tick) doneButton.append(tick);
  const toolBox = make('div', { class: 'fd-field-tools' }, editButton, doneButton);
  const element = make('div', { class: 'fd-md-field' }, toolBox, view, text.element);
  text.element.hidden = true;

  const name_ = () => {
    const words = fillIn(labels.editNamed, { name: label() });
    setAttr(editButton, 'aria-label', words);
    setAttr(editButton, 'title', words);
    setAttr(doneButton, 'aria-label', labels.doneEditing);
    setAttr(doneButton, 'title', labels.doneEditing);
  };
  name_();

  function render(value: string | null) {
    const clean = value ? sanitizeHtml(value, document) : '';
    const shown = decorateLinks(clean, document);
    if (view.innerHTML !== shown) view.innerHTML = shown;
    view.classList.toggle('fd-blank', !clean);
  }
  function start() {
    if (editing || readonly) return;
    editing = true;
    before = (form.getState().values[name] as string | null | undefined) ?? null;
    text.setValue(before);
    view.hidden = true;
    text.element.hidden = false;
    editButton.hidden = true;
    doneButton.hidden = false;
    element.setAttribute('data-editing', '');
    text.focus();
  }
  function finish(keep: boolean) {
    if (!editing) return;
    editing = false;
    if (!keep) form.setValue(name, before);
    view.hidden = false;
    text.element.hidden = true;
    editButton.hidden = readonly;
    doneButton.hidden = true;
    element.removeAttribute('data-editing');
    render((form.getState().values[name] as string | null | undefined) ?? null);
    view.focus();
  }
  editButton.addEventListener('click', start);
  doneButton.addEventListener('click', () => finish(true));
  view.addEventListener('click', (event) => {
    if ((event.target as Element).closest?.('a')) return;
    start();
  });
  view.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || (event.target as Element).closest?.('a')) return;
    event.preventDefault();
    start();
  });

  return {
    element,
    tools: [editButton, doneButton],
    focus: () => (editing ? text.focus() : view.focus()),
    destroy: () => text.destroy(),
    update(state) {
      readonly = state.readonly;
      const value = typeof state.value === 'string' ? state.value : null;
      if (editing) text.setValue(value);
      else render(value);
      text.setReadonly(state.readonly);
      if (readonly && editing) finish(true);
      editButton.hidden = readonly || editing;
      setAttr(view, 'aria-readonly', String(readonly));
      setAttr(view, 'tabindex', readonly ? '-1' : '0');
      name_();
      for (const box of [view, text.input()]) {
        setAttr(box, 'aria-invalid', String(state.invalid));
        setAttr(box, 'aria-describedby', state.describedBy || null);
      }
    },
  };
}
