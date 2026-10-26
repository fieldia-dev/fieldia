import { plainPart, type JsonValue } from '@fieldia/core';
import { decorateLinks, formattedText, type TextReference } from './formatted-text';
import { headedTables } from './rich-table';
import { drawIcon } from './icons';
import { fillIn, maker, setAttr } from './kind-parts';
import { WIDGET_LABELS } from './labels';
import { sanitizeHtml } from './sanitize';
import { showHtml } from './style-attributes';
import { TEXT_TOOLS, type TextTool } from './text-tools';
import type { Widget, WidgetContext } from './widgets';

/**
 * A formatted text field drawn as a work item draws one. Its options:
 *
 *   toolbar      'always' (true), 'focus' — no edge and no toolbar at rest, a
 *                light box when pointed at, the accent box with the toolbar
 *                inside it while worked in — or 'never' (false)
 *   toolbarAt    'top' or 'bottom' (the foot unless said, with 'focus')
 *   tools        the tools, in order: bold … attach, table (text-tools.ts)
 *   editor       'rich', or 'markdown': at rest the text as it reads, its
 *                links opening in a tab of their own; a click on its words,
 *                Enter, or Edit in its group's heading opens the Markdown
 *                card; Done keeps what was typed, Escape puts back what it held
 *   edit         'button': the rich editor read first, as Markdown is — the
 *                text formatted, its links opening, its pictures in place;
 *                Edit (its group's ✎), Enter or a click on its words opens
 *                the editor; Done, or a press or the focus outside it, keeps
 *                what was typed, Escape puts back what it held. Empty, it is
 *                its editor at rest, its placeholder saying what to add
 *   switchEditor a link under it to the other editor
 *   mention      { model }: people @mentioned, found with form.search
 *   references   [{ key, model, label, icon }]: records linked by "#", "!" …
 *
 * Whichever the editor, the value is stored as clean HTML.
 */

const isTool = (tool: unknown): tool is TextTool => typeof tool === 'string' && (TEXT_TOOLS as readonly string[]).includes(tool);
const record = (value: JsonValue | undefined): Record<string, JsonValue> | null => (value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null);

export function modernHtml(context: WidgetContext): Widget {
  const { form, name, node, id, document, labels = WIDGET_LABELS.en, locale } = context;
  const make = maker(document);
  const options = node.options ?? {};
  const pageEditor = options['editor'] === 'markdown' ? 'markdown' : 'rich';
  // Read first, edited from its Edit: Markdown always; the rich editor where the page says so (`edit: "button"`).
  const rich = pageEditor === 'rich';
  const readFirst = !rich || options['edit'] === 'button';
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

  let editing = !readFirst;
  let readonly = false;
  /** What the field held as editing began: Escape puts it back. */
  let before: string | null = null;
  /** What the field holds now, as the form last said. */
  let held: string | null = null;

  const text = formattedText(document, {
    id: !readFirst ? id : `${id}-${pageEditor}`,
    labelledBy: `${id}-label`,
    placeholder: node.placeholder,
    labels,
    ...(locale ? { locale } : {}),
    editor: pageEditor,
    tools,
    toolbar,
    ...(typeof options['toolbarAt'] === 'string' ? { toolbarAt: options['toolbarAt'] === 'top' ? 'top' : 'bottom' } : {}),
    switchEditor: options['switchEditor'] === true,
    ...(mentionModel ? { mention: { search: (query: string) => form.search(name, query, 8, { model: mentionModel }) } } : {}),
    references,
    onInput(html) {
      // Typed in a rich text open at rest (an empty one): editing from here, what it held kept for Escape.
      if (readFirst && !editing) begin();
      form.setValue(name, html);
    },
    onKey(event) {
      if (event.key !== 'Escape' || !readFirst || !editing) return false;
      event.preventDefault();
      event.stopPropagation();
      finish(false);
      return true;
    },
  });

  if (!readFirst) {
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

  // ---- read first: the text as it reads at rest, the editor while it is edited ----
  // (A rich one empty and open to change is its editor at rest, its placeholder saying what to add.)
  const view = make('div', { class: 'fd-md-view', id, role: 'textbox', 'aria-multiline': 'true', 'aria-readonly': 'false', tabindex: '0', 'aria-labelledby': `${id}-label` });
  if (node.placeholder && !rich) view.setAttribute('data-placeholder', node.placeholder);
  const label = () => document.getElementById(`${id}-label`)?.textContent?.trim() || plainPart(form.page.fields[name])?.label || name;
  const editButton = make('button', { type: 'button', class: 'fd-field-tool', 'data-tool': 'edit' });
  const doneButton = make('button', { type: 'button', class: 'fd-field-tool', 'data-tool': 'done', hidden: '' });
  const pencil = drawIcon(document, 'edit');
  const tick = drawIcon(document, 'check');
  if (pencil) editButton.append(pencil);
  if (tick) doneButton.append(tick);
  const toolBox = make('div', { class: 'fd-field-tools' }, editButton, doneButton);
  const element = make('div', { class: 'fd-md-field', 'data-editor': pageEditor }, toolBox, view, text.element);
  text.element.hidden = true;

  const name_ = () => {
    const words = fillIn(labels.editNamed, { name: label() });
    setAttr(editButton, 'aria-label', words);
    setAttr(editButton, 'title', words);
    setAttr(doneButton, 'aria-label', labels.doneEditing);
    setAttr(doneButton, 'title', labels.doneEditing);
  };
  name_();

  // A table's header row in its head, as it shows and prints, though the value holds it among the rows.
  const clean = (value: string | null) => (value ? headedTables(sanitizeHtml(value, document), document) : '');
  /** A rich text with nothing in it, open to change: its editor shows at rest. */
  const openAtRest = () => rich && !readonly && !clean(held).replace(/<br\s*\/?>|<\/?(p|div|span)>|&nbsp;|\s/gi, '');
  function render(value: string | null) {
    const shown = decorateLinks(clean(value), document);
    if (view.innerHTML !== shown) showHtml(view, shown);
    view.classList.toggle('fd-blank', !clean(value));
  }
  /** The view or the editor, and Edit or Done, as it stands. */
  function show() {
    const open = editing || openAtRest();
    view.hidden = open;
    text.element.hidden = !open;
    editButton.hidden = readonly || open;
    doneButton.hidden = !editing;
    element.toggleAttribute('data-editing', editing);
  }
  /** A press or a key outside the field and its tools, a rich text being edited: what was typed kept, the text read again. */
  const outside = (event: Event) => {
    const at = event.target as Node;
    if (!element.contains(at) && !editButton.parentElement?.contains(at)) finish(true, false);
  };
  function begin() {
    if (editing || readonly) return;
    editing = true;
    before = held;
    show();
    if (!rich) return;
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('focusin', outside, true);
  }
  function start() {
    if (editing || readonly) return;
    begin();
    text.setValue(before);
    text.focus();
  }
  function finish(keep: boolean, refocus = true) {
    if (!editing) return;
    editing = false;
    document.removeEventListener('pointerdown', outside, true);
    document.removeEventListener('focusin', outside, true);
    if (!keep) form.setValue(name, before);
    // Its words the same as it held, but written another way (the editor's own markup): as it held them, unchanged.
    else if (rich && held !== before && clean(held).replace(/\s+/g, ' ') === clean(before).replace(/\s+/g, ' ')) form.setValue(name, before);
    show();
    render(held);
    if (refocus && !view.hidden) view.focus();
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
    focus: () => (view.hidden ? text.focus() : view.focus()),
    destroy() {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('focusin', outside, true);
      text.destroy();
    },
    update(state) {
      readonly = state.readonly;
      held = typeof state.value === 'string' ? state.value : null;
      if (readonly && editing) finish(true);
      if (editing || openAtRest()) text.setValue(held);
      else render(held);
      text.setReadonly(state.readonly);
      show();
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
