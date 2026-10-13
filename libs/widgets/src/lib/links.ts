import type { Field, RelatedRecord } from '@fieldia/core';
import { drawIcon } from './icons';
import { fillIn, maker, setAttr, setHidden } from './kind-parts';
import { WIDGET_LABELS } from './labels';
import { linkedWords } from './linked-words';
import { textMenu } from './text-menu';
import { chevron } from './text-tools';
import type { WidgetFactory } from './widgets';

/**
 * A many2many as a work item's links (`many2many.links`): "Add link" — a
 * menu of Existing item and New item (`add: 'menu'`), or a search at once
 * (`add: 'search'`) — then a row for each record linked, its name opening
 * it and × taking it away, never deleting it. While none is linked, a light
 * box says what to link (`help`, with [words](address) links in it and an
 * icon before them, `helpIcon` — white on a tile of `helpTile`'s colour,
 * `#rrggbb`, as a tracker marks its code's links), or offers a link that
 * finds an existing record (`emptyLink`). `addLabel` words the button.
 *
 * Existing item searches with the dialog's Search more…; New item opens a
 * new record of the relation in a dialog, and links it once saved.
 */
export const linksWidget: WidgetFactory = ({ form, name, field, node, id, document, labels = WIDGET_LABELS.en, dialogs }) => {
  const def = field as Extract<Field, { type: 'many2many' }>;
  const make = maker(document);
  const options = node.options ?? {};
  const words = (key: string) => (typeof options[key] === 'string' && (options[key] as string).trim() ? (options[key] as string) : null);
  const asMenu = options['add'] === 'menu';
  const addWords = words('addLabel') ?? labels.addLink;

  const add = make('button', { type: 'button', class: 'fd-links-add' }, make('span', {}, addWords));
  if (asMenu) add.append(chevron(document));
  const menu = asMenu ? textMenu(document, add, { label: addWords, align: 'end', className: 'fd-links-menu' }) : null;
  const list = make('ul', { class: 'fd-links-list' });
  const helpText = words('help');
  const drawn = typeof options['helpIcon'] === 'string' ? drawIcon(document, options['helpIcon']) : null;
  const tile = typeof options['helpTile'] === 'string' && /^#[0-9a-fA-F]{6}$/.test(options['helpTile']) ? options['helpTile'] : null;
  // Its icon in the muted colour, or white on a tile of the page's colour.
  const helpIcon = drawn && tile ? make('span', { class: 'fd-links-help-icon fd-links-help-tile', 'aria-hidden': 'true' }, drawn) : drawn;
  if (drawn && tile) helpIcon?.style.setProperty('--fd-tile', tile);
  else drawn?.classList.add('fd-links-help-icon');
  const help = helpText ? make('div', { class: 'fd-links-help' }, ...(helpIcon ? [helpIcon] : []), make('p', {}, ...linkedWords(document, helpText))) : null;
  const emptyWords = words('emptyLink');
  const emptyButton = emptyWords ? make('button', { type: 'button', class: 'fd-links-empty-link' }, emptyWords) : null;
  const empty = emptyButton ? make('div', { class: 'fd-links-empty' }, emptyButton) : null;
  const element = make('div', { class: 'fd-links-box', id, role: 'group' }, add, ...(menu ? [menu.element] : []), list, ...(help ? [help] : []), ...(empty ? [empty] : []));

  let readonly = false;
  let shown: RelatedRecord[] = [];
  const linked = () => (form.getState().values[name] as RelatedRecord[] | null) ?? [];
  const link = (record: RelatedRecord | null) => {
    if (!record || linked().some((r) => r.id === record.id)) return;
    form.setValue(name, [...linked(), { id: record.id, label: record.label }]);
  };

  async function existing() {
    if (!dialogs || readonly) return;
    link(await dialogs.searchMore({ title: def.label, search: (query, limit) => form.search(name, query, limit) }));
  }
  async function created() {
    if (!dialogs || readonly) return;
    link(await dialogs.openRecord(def.relation, { title: def.label }));
  }

  add.addEventListener('click', () => {
    if (!menu) return void existing();
    if (menu.isOpen()) return menu.close();
    const canMake = !!dialogs?.canOpen(def.relation);
    menu.open([
      { label: labels.existingItem, lead: drawIcon(document, 'link'), run: () => void existing() },
      ...(canMake ? [{ label: labels.newItem, lead: drawIcon(document, 'edit'), run: () => void created() }] : []),
    ]);
  });
  add.addEventListener('keydown', (event) => {
    if (menu && event.key === 'ArrowDown' && !menu.isOpen()) {
      event.preventDefault();
      add.click();
    }
  });
  emptyButton?.addEventListener('click', () => void existing());

  async function open(record: RelatedRecord) {
    const saved = await dialogs?.openRecord(def.relation, { recordId: record.id, title: record.label });
    if (saved && saved.label !== record.label) form.setValue(name, linked().map((r) => (r.id === record.id ? { id: r.id, label: saved.label } : r)));
  }

  function row(record: RelatedRecord): HTMLLIElement {
    const canOpen = !!dialogs?.canOpen(def.relation);
    const title = canOpen ? make('button', { type: 'button', class: 'fd-links-name' }, record.label) : make('span', { class: 'fd-links-name' }, record.label);
    if (canOpen) title.addEventListener('click', () => void open(record));
    const item = make('li', { 'data-record': String(record.id) }, title);
    if (!readonly) {
      const remove = make('button', { type: 'button', class: 'fd-links-remove', 'aria-label': fillIn(labels.remove, { name: record.label }), title: fillIn(labels.remove, { name: record.label }) });
      const cross = drawIcon(document, 'close');
      if (cross) remove.append(cross);
      remove.addEventListener('click', () => {
        const at = shown.indexOf(record);
        form.setValue(name, linked().filter((r) => r.id !== record.id));
        // The focus to the next row's ×, else the one before, else Add link.
        queueMicrotask(() => ((list.querySelectorAll<HTMLElement>('.fd-links-remove')[Math.min(at, shown.length - 1)] ?? add) as HTMLElement).focus());
      });
      item.append(remove);
    }
    return item;
  }

  return {
    element,
    focus: () => add.focus(),
    destroy: () => menu?.close(false),
    update(state) {
      const now = (state.value as RelatedRecord[] | null) ?? [];
      const changed = now !== shown || readonly !== state.readonly;
      readonly = state.readonly;
      shown = now;
      setHidden(add, readonly || !dialogs);
      if (help) setHidden(help, now.length > 0);
      if (empty) setHidden(empty, now.length > 0 || readonly || !dialogs);
      setHidden(list, !now.length);
      if (changed) list.replaceChildren(...now.map(row));
      setAttr(element, 'aria-invalid', String(state.invalid));
      setAttr(element, 'aria-describedby', state.describedBy || null);
    },
  };
};
