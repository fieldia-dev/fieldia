import type { ButtonNode, Field, FieldNode, HeadLink, LayoutNode, Page, RelatedNode, SheetNode } from '@fieldia/core';
import { ICONS } from '@fieldia/widgets';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { findNode, findTab, tabsNodes } from './page-tree';
import { setting } from './panel-controls';
import { tracksFrom } from './head-commands';
import { settingNumber } from './number-box';

/**
 * A record's head in the panel: the sheet's "Record head" settings — on or
 * off, its kind and each kind's look, its number, Copy title, the row under
 * the title, its buttons, the band's fields with their access keys, its
 * columns and labels' width, "Updated by" — and the parts it brought to other
 * panels: a button's icon alone, toggle, menu and look while the record has
 * changes; a tab's icon and count, and tabs in the head; a field's access key.
 */

export interface SettingRows {
  rows: HTMLElement[];
  update(page: Page): void;
}

const focused = (node: Element) => node.ownerDocument.activeElement === node;

/** The page's fields and the model's, each once, by name. */
function allFields(designer: Designer, page: Page): [string, Field][] {
  const own = Object.entries(page.fields);
  const names = new Set(own.map(([name]) => name));
  return [...own, ...designer.modelFields().filter((m) => !names.has(m.name)).map((m) => [m.name, m.field] as [string, Field])];
}

/** A select of choices, drawn again only when its choices change, then set to `value`. */
function fill(el: ElementFactory, select: HTMLSelectElement, choices: [string, string][], value: string) {
  const key = JSON.stringify(choices);
  if (select.dataset['choices'] !== key) {
    select.dataset['choices'] = key;
    select.replaceChildren(...choices.map(([v, words]) => el('option', { value: v }, words)));
  }
  if (!focused(select)) select.value = value;
}

const box = (el: ElementFactory, label: string, attrs: Record<string, string> = {}) => el('input', { class: 'fd-input', 'aria-label': label, autocomplete: 'off', ...attrs }) as HTMLInputElement;
const pick = (el: ElementFactory, label: string) => el('select', { class: 'fd-input fd-select', 'aria-label': label }) as HTMLSelectElement;
const tick = (el: ElementFactory, label: string) => el('input', { type: 'checkbox', class: 'fd-check', 'aria-label': label }) as HTMLInputElement;
const ICON_NAMES = () => Object.keys(ICONS).sort();

/** The sheet's Record head settings, for the page's panel; none on a page that is no sheet. */
export function headSettings(el: ElementFactory, designer: Designer): SettingRows {
  const w = designer.words.head;
  const on = tick(el, w.headOn);
  on.addEventListener('change', () => designer.setHead(on.checked ? {} : null));
  const onRow = setting(el, 'content', 'Record head', on, { hint: w.recordHeadHint, words: w.recordHead });

  const kindFrom = pick(el, w.kindFrom);
  kindFrom.addEventListener('change', () => designer.setHead({ kindField: kindFrom.value || null }));
  const kindWords = box(el, w.kindWords);
  kindWords.addEventListener('input', () => designer.setHead({ kindLabel: kindWords.value }));
  const numberFrom = pick(el, w.numberFrom);
  numberFrom.addEventListener('change', () => designer.setHead({ numberField: numberFrom.value || null }));
  const colour = box(el, w.kindColour, { type: 'color' });
  colour.addEventListener('change', () => designer.setHead({ colour: colour.value }));
  const icon = pick(el, w.kindIcon);
  icon.addEventListener('change', () => designer.setHead({ icon: icon.value || null }));
  const looks = el('div', { class: 'fd-head-looks' });
  const copy = tick(el, w.copyTitle);
  copy.addEventListener('change', () => designer.setHead({ copyTitle: copy.checked }));
  const tracks = box(el, w.bandColumns, { placeholder: '1fr 1fr', spellcheck: 'false' });
  // Apart by spaces or commas, in any digits, as a group's widths are.
  tracks.addEventListener('change', () => designer.setHead({ tracks: tracksFrom(tracks.value) }));
  // A whole number of pixels, 48 to 320; emptied, the usual.
  let labelsWide: number | null = null;
  const labelWidth = settingNumber(el, designer, {
    label: w.labelWidth,
    attrs: { class: 'fd-input', placeholder: '76' },
    integer: true,
    min: 48,
    max: 320,
    optional: true,
    saved: () => labelsWide,
    commit: (n) => designer.setHead({ labelWidth: n }),
  });
  const by = pick(el, w.updatedBy);
  const at = pick(el, w.updatedAt);
  const opens = pick(el, w.updatedOpens);
  const setUpdated = () => designer.setHead({ updated: by.value && at.value ? { byField: by.value, atField: at.value, opens: opens.value || null } : null });
  for (const control of [by, at, opens]) control.addEventListener('change', setUpdated);

  // The row under the title, the buttons, the band's fields: lists with their own adders.
  const rowList = el('div', { class: 'fd-head-list' });
  const addRowField = pick(el, w.addRowField);
  addRowField.addEventListener('change', () => {
    if (addRowField.value) designer.addHeadPart('meta', { field: addRowField.value });
    addRowField.value = '';
  });
  const addRowLink = pick(el, w.addRowLink);
  addRowLink.addEventListener('change', () => {
    if (addRowLink.value) designer.addHeadPart('meta', { link: addRowLink.value });
    addRowLink.value = '';
  });
  const buttonList = el('div', { class: 'fd-head-list' });
  const addButton = el('button', { type: 'button', class: 'fd-button fd-button-link' }, w.addButton);
  addButton.addEventListener('click', () => designer.addHeadPart('actions', { button: w.newButton }));
  const bandList = el('div', { class: 'fd-head-list' });
  const addBandField = pick(el, w.addBandField);
  addBandField.addEventListener('change', () => {
    if (addBandField.value) designer.addHeadPart('band', { field: addBandField.value });
    addBandField.value = '';
  });

  const rows = [
    onRow,
    setting(el, 'content', 'Kind from', kindFrom, { words: w.kindFrom }),
    setting(el, 'content', 'Kind’s words', kindWords, { hint: w.kindWordsHint, words: w.kindWords }),
    setting(el, 'content', 'Number from', numberFrom, { words: w.numberFrom }),
    setting(el, 'content', 'Kind’s colour', colour, { words: w.kindColour }),
    setting(el, 'content', 'Kind’s icon', icon, { words: w.kindIcon }),
    setting(el, 'content', 'Each kind’s look', looks, { words: w.kindLooks }),
    setting(el, 'content', 'Copy title button', copy, { words: w.copyTitle }),
    setting(el, 'content', 'Row under the title', [rowList, addRowField, addRowLink], { words: w.rowParts }),
    setting(el, 'content', 'Buttons', [buttonList, addButton], { hint: w.buttonHint, words: w.actions }),
    setting(el, 'content', 'Band’s fields', [bandList, addBandField], { words: w.bandFields }),
    setting(el, 'layout', 'Band’s columns', tracks, { hint: w.bandColumnsHint, words: w.bandColumns }),
    setting(el, 'layout', 'Band’s labels’ width', labelWidth.input, { words: w.labelWidth }),
    setting(el, 'content', 'Updated by', by, { words: w.updatedBy }),
    setting(el, 'content', 'Updated on', at, { words: w.updatedAt }),
    setting(el, 'content', 'Pressed, “Updated by” shows', opens, { words: w.updatedOpens }),
  ];
  const [, , wordsRow, , colourRow, iconRow, looksRow] = rows;
  let drawnLists = '';

  /** A part's line in its list: its name, what it has of its own, earlier, later and remove. */
  const partLine = (id: string, name: string, own: HTMLElement[], index: number, count: number) => {
    const tool = (label: string, words: string, run: () => void, hidden = false) => {
      const button = el('button', { type: 'button', class: 'fd-icon-button', 'aria-label': label, title: label, ...(hidden ? { hidden: '' } : {}) }, words);
      button.addEventListener('click', run);
      return button;
    };
    return el(
      'div',
      { class: 'fd-head-line', 'data-part': id },
      el('span', { class: 'fd-head-line-name' }, name),
      ...own,
      tool(w.moveEarlier(name), '↑', () => designer.moveHeadPart(id, -1), index === 0),
      tool(w.moveLater(name), '↓', () => designer.moveHeadPart(id, 1), index === count - 1),
      tool(w.removeNamed(name), '×', () => designer.removeHeadPart(id))
    );
  };

  return {
    rows,
    update(page) {
      const root = page.layout;
      const sheet = root.type === 'sheet' ? root : null;
      const head = sheet?.head;
      for (const row of rows) row.hidden = !sheet || (row !== onRow && !head);
      if (!sheet) return;
      on.checked = !!head;
      if (!head) return;
      const fields = allFields(designer, page);
      const label = (name: string) => page.fields[name]?.label ?? fields.find(([n]) => n === name)?.[1].label ?? name;
      const kind = head.kind ?? {};
      fill(el, kindFrom, [['', w.oneKind], ...fields.filter(([, f]) => (f.type === 'selection' && !f.multiple) || f.type === 'many2one').map(([n, f]) => [n, f.label] as [string, string])], kind.field ?? '');
      wordsRow.hidden = colourRow.hidden = iconRow.hidden = !!kind.field;
      if (!focused(kindWords)) kindWords.value = kind.label ?? '';
      fill(el, numberFrom, [['', w.recordsId], ...fields.filter(([, f]) => ['integer', 'float', 'char'].includes(f.type)).map(([n, f]) => [n, f.label] as [string, string])], kind.numberField ?? '');
      if (!focused(colour)) colour.value = kind.colour ?? '#cc293d';
      const icons: [string, string][] = [['', w.noIcon], ...ICON_NAMES().map((name) => [name, name] as [string, string])];
      fill(el, icon, icons, kind.icon ?? '');
      // Each kind's colour and icon, by the choice's values.
      const def = kind.field ? page.fields[kind.field] : undefined;
      const options = def?.type === 'selection' ? def.options : [];
      looksRow.hidden = !options.length;
      const looksKey = JSON.stringify([options, kind.looks]);
      if (looks.dataset['drawn'] !== looksKey && !looks.contains(looks.ownerDocument.activeElement)) {
        looks.dataset['drawn'] = looksKey;
        looks.replaceChildren(
          ...options.map((option) => {
            const value = String(option.value);
            const look = kind.looks?.[value];
            const swatch = box(el, w.colourOf(option.label), { type: 'color', value: look?.colour ?? '#7e7e7e' });
            const mark = pick(el, w.iconOf(option.label));
            fill(el, mark, icons, look?.icon ?? '');
            const set = () => designer.setHeadKindLook(value, { colour: swatch.value, ...(mark.value ? { icon: mark.value } : {}) });
            swatch.addEventListener('change', set);
            mark.addEventListener('change', set);
            return el('div', { class: 'fd-head-look', 'data-value': value }, el('span', { class: 'fd-head-line-name' }, option.label), swatch, mark);
          })
        );
      }
      copy.checked = head.copyTitle !== false;
      if (!focused(tracks)) tracks.value = (head.band?.tracks ?? []).join(' ');
      labelsWide = head.band?.labelWidth ?? null;
      labelWidth.refresh();
      // "Updated by": who, when, and the tab it opens.
      const tabs = tabsNodes(page).flatMap((t) => t.children);
      fill(el, by, [['', w.noUpdated], ...fields.filter(([, f]) => ['many2one', 'char'].includes(f.type)).map(([n, f]) => [n, f.label] as [string, string])], head.updated?.byField ?? '');
      fill(el, at, [['', w.noUpdated], ...fields.filter(([, f]) => f.type === 'date' || f.type === 'datetime').map(([n, f]) => [n, f.label] as [string, string])], head.updated?.atField ?? '');
      fill(el, opens, [['', w.noTab], ...tabs.map((t) => [t.id, t.label] as [string, string])], head.updated?.opens ?? '');
      // What can be added: a field not in the head yet; a count of a number field.
      const placed = new Set([...(head.meta ?? []), ...(head.band?.children ?? [])].flatMap((part) => (part.type === 'field' ? [part.field] : [])));
      const free = fields.filter(([n, f]) => !placed.has(n) && !['one2many', 'html', 'json', 'properties'].includes(f.type));
      fill(el, addRowField, [['', w.pick], ...free.map(([n, f]) => [n, f.label] as [string, string])], '');
      fill(el, addRowLink, [['', w.pick], ...fields.filter(([, f]) => ['integer', 'float', 'monetary'].includes(f.type)).map(([n, f]) => [n, f.label] as [string, string])], '');
      fill(el, addBandField, [['', w.pick], ...free.map(([n, f]) => [n, f.label] as [string, string])], '');
      // The lists, drawn again only when the head's parts change and nothing in them is being typed in.
      const listsKey = JSON.stringify([head.meta, head.actions, head.band?.children, tabs.map((t) => t.id)]);
      const busy = [rowList, bandList, buttonList].some((list) => list.contains(list.ownerDocument.activeElement) && list.ownerDocument.activeElement?.tagName === 'INPUT');
      if (listsKey === drawnLists || busy) return;
      drawnLists = listsKey;
      const meta = head.meta ?? [];
      rowList.replaceChildren(
        ...meta.map((part, i) => {
          if (part.type === 'field') return partLine(part.id, label(part.field), [], i, meta.length);
          const link = part as HeadLink;
          const name = label(link.field);
          const one = box(el, w.linkWordsOne(name), { value: link.words.one ?? '' });
          one.addEventListener('input', () => designer.updateHeadLink(link.id, { one: one.value }));
          const other = box(el, w.linkWordsOther(name), { value: link.words.other });
          other.addEventListener('input', () => designer.updateHeadLink(link.id, { other: other.value }));
          const target = pick(el, w.linkTarget(name));
          const parts = [['', w.nowhere], ...tabs.map((t) => [t.id, t.label]), ...sectionTargets(page)] as [string, string][];
          fill(el, target, parts, link.target ?? '');
          target.addEventListener('change', () => designer.updateHeadLink(link.id, { target: target.value }));
          return partLine(link.id, name, [one, other, target], i, meta.length);
        })
      );
      const actions = head.actions ?? [];
      buttonList.replaceChildren(
        ...actions.map((button: ButtonNode, i) => {
          const open = el('button', { type: 'button', class: 'fd-button fd-button-link' }, button.label);
          open.addEventListener('click', () => designer.select(button.id));
          return partLine(button.id, button.label, [open], i, actions.length);
        })
      );
      const band = head.band?.children ?? [];
      bandList.replaceChildren(
        ...band.map((part, i) => {
          if (part.type !== 'field') return partLine(part.id, part.id, [], i, band.length);
          const node = part as FieldNode;
          const key = box(el, w.accessKeyOf(label(node.field)), { value: node.hotkey ?? '', maxlength: '1', class: 'fd-input fd-hotkey-input' });
          key.addEventListener('change', () => designer.setFieldHotkey(node.id, key.value || null));
          return partLine(node.id, label(node.field), [key], i, band.length);
        })
      );
    },
  };
}

/** The groups a count can take the reader to, by their titles. */
function sectionTargets(page: Page): [string, string][] {
  const found: [string, string][] = [];
  const walk = (nodes: readonly LayoutNode[]) => {
    for (const node of nodes) {
      if (node.type === 'section') {
        if (node.title) found.push([node.id, node.title]);
        walk(node.children);
      }
      if (node.type === 'tabs') for (const tab of node.children) walk(tab.children);
    }
  };
  const root = page.layout;
  if (root.type === 'sheet' || root.type === 'sections') walk(root.children);
  return found;
}

/** A button's own parts: its icon alone, a toggle and its words, the look while the record has changes, a menu beside it. */
export function buttonPartsSettings(el: ElementFactory, designer: Designer, id: string): SettingRows {
  const w = designer.words.head;
  const icon = pick(el, w.icon);
  icon.addEventListener('change', () => designer.setButtonParts(id, { icon: icon.value || null }));
  const iconOnly = tick(el, w.iconOnly);
  iconOnly.addEventListener('change', () => designer.setButtonParts(id, { iconOnly: iconOnly.checked }));
  const toggle = pick(el, w.toggle);
  toggle.addEventListener('change', () => designer.setButtonParts(id, { pressed: toggle.value || null }));
  const pressedWords = box(el, w.pressedWords);
  pressedWords.addEventListener('input', () => designer.setButtonParts(id, { pressedLabel: pressedWords.value }));
  const primary = tick(el, w.primaryWhenChanged);
  primary.addEventListener('change', () => designer.setButtonParts(id, { primaryWhenChanged: primary.checked }));
  const menuList = el('div', { class: 'fd-head-list' });
  const addChoice = el('button', { type: 'button', class: 'fd-button fd-button-link' }, w.addChoice);
  const menuIcon = pick(el, w.chevronIcon);
  menuIcon.addEventListener('change', () => designer.setButtonParts(id, { menuIcon: menuIcon.value || null }));
  const menuName = box(el, w.chevronName);
  menuName.addEventListener('input', () => designer.setButtonParts(id, { menuLabel: menuName.value }));
  const current = (): ButtonNode | undefined => {
    const page = designer.getPage();
    const root = page.layout;
    const node = findNode(page, id)?.node;
    if (node?.type === 'button') return node;
    return root.type === 'sheet' ? [...(root.head?.actions ?? []), ...(root.buttons ?? [])].find((b) => b.id === id) : undefined;
  };
  const items = () => (current()?.menu ?? []).map((item) => ({ id: item.id, label: item.label ?? item.id, action: item.action ?? '' }));
  addChoice.addEventListener('click', () => designer.setButtonParts(id, { menu: [...items(), { label: w.newChoice, action: '' }] }));
  const pressedRow = setting(el, 'content', 'Words while pressed', pressedWords, { words: w.pressedWords });
  const chevronRows = [setting(el, 'content', 'Chevron’s icon', menuIcon, { words: w.chevronIcon }), setting(el, 'content', 'Chevron’s name', menuName, { words: w.chevronName })];
  const rows = [
    setting(el, 'content', 'Icon', icon, { words: w.icon }),
    setting(el, 'content', 'Its icon alone', iconOnly, { words: w.iconOnly }),
    setting(el, 'content', 'Pressed while', toggle, { words: w.toggle }),
    pressedRow,
    setting(el, 'content', 'Primary while the record has changes', primary, { words: w.primaryWhenChanged }),
    setting(el, 'content', 'Menu beside it', [menuList, addChoice], { hint: w.menuHint, words: w.menu }),
    ...chevronRows,
  ];
  let drawn = '';
  return {
    rows,
    update(page) {
      const button = current();
      for (const row of rows) row.hidden = !button;
      if (!button) return;
      const icons: [string, string][] = [['', w.noIcon], ...ICON_NAMES().map((name) => [name, name] as [string, string])];
      fill(el, icon, icons, button.icon ?? '');
      iconOnly.checked = button.iconOnly === true;
      const flags = allFields(designer, page).filter(([, f]) => f.type === 'boolean');
      fill(el, toggle, [['', w.notToggle], ...flags.map(([n, f]) => [n, f.label] as [string, string])], typeof button.pressed === 'string' ? button.pressed : '');
      pressedRow.hidden = button.pressed === undefined;
      if (!focused(pressedWords)) pressedWords.value = button.pressedLabel ?? '';
      primary.checked = button.primaryWhenChanged === true;
      for (const row of chevronRows) row.hidden = !button.menu?.length;
      fill(el, menuIcon, [['', w.noIcon], ...ICON_NAMES().map((name) => [name, name] as [string, string])], button.menuIcon ?? '');
      if (!focused(menuName)) menuName.value = button.menuLabel ?? '';
      const key = JSON.stringify(button.menu ?? []);
      if (key === drawn || menuList.contains(menuList.ownerDocument.activeElement)) return;
      drawn = key;
      const list = items();
      menuList.replaceChildren(
        ...list.map((item, i) => {
          const words = box(el, `${w.choiceWords} ${i + 1}`, { value: item.label });
          const action = box(el, `${w.choiceAction} ${i + 1}`, { value: item.action, spellcheck: 'false' });
          const save = () => designer.setButtonParts(id, { menu: items().map((one) => (one.id === item.id ? { ...one, label: words.value, action: action.value } : one)) });
          words.addEventListener('change', save);
          action.addEventListener('change', save);
          const remove = el('button', { type: 'button', class: 'fd-icon-button', 'aria-label': w.removeNamed(item.label), title: w.removeNamed(item.label) }, '×');
          remove.addEventListener('click', () => designer.setButtonParts(id, { menu: items().filter((one) => one.id !== item.id) }));
          return el('div', { class: 'fd-head-line', 'data-part': item.id }, words, action, remove);
        })
      );
    },
  };
}

/** What a related list counted by a tab is, among the Count from's choices: its id after this, never a field's name. */
const RELATED_COUNT = 'related:';

/**
 * A tab's icon, shown alone or with its words, and what its count after it counts: a field, or the records of a
 * related list in the tab.
 */
export function tabPartsSettings(el: ElementFactory, designer: Designer, id: string): SettingRows {
  const w = designer.words.head;
  const icon = pick(el, w.tabIcon);
  icon.addEventListener('change', () => designer.setTabParts(id, { icon: icon.value || null }));
  const iconOnly = tick(el, w.tabIconOnly);
  iconOnly.addEventListener('change', () => designer.setTabParts(id, { iconOnly: iconOnly.checked }));
  const count = pick(el, w.countFrom);
  count.addEventListener('change', () =>
    designer.setTabParts(id, { count: count.value.startsWith(RELATED_COUNT) ? { related: count.value.slice(RELATED_COUNT.length) } : count.value || null })
  );
  const rows = [setting(el, 'content', 'Tab’s icon', icon, { words: w.tabIcon }), setting(el, 'content', 'Tab’s icon alone', iconOnly, { words: w.tabIconOnly }), setting(el, 'content', 'Count from', count, { words: w.countFrom })];
  return {
    rows,
    update(page) {
      const tab = findTab(page, id)?.tab;
      if (!tab) return;
      fill(el, icon, [['', w.noIcon], ...ICON_NAMES().map((name) => [name, name] as [string, string])], tab.icon ?? '');
      iconOnly.checked = tab.iconOnly === true;
      const counted = allFields(designer, page).filter(([, f]) => ['integer', 'float', 'monetary', 'one2many', 'many2many', 'binary', 'image'].includes(f.type));
      const lists = relatedListsIn(tab.children).map((list) => [`${RELATED_COUNT}${list.id}`, w.countRelated(list.title || list.model)] as [string, string]);
      const now = typeof tab.count === 'string' ? tab.count : tab.count ? `${RELATED_COUNT}${tab.count.related}` : '';
      fill(el, count, [['', w.noCount], ...counted.map(([n, f]) => [n, f.label] as [string, string]), ...lists], now);
    },
  };
}

/** Tabs directly in a sheet with a head: in the head's band, or over the body. */
export function tabsInHeadSetting(el: ElementFactory, designer: Designer, id: string): SettingRows {
  const w = designer.words.head;
  const inHead = tick(el, w.inHead);
  inHead.addEventListener('change', () => designer.setTabsInHead(id, inHead.checked));
  const row = setting(el, 'layout', 'In the record’s head', inHead, { hint: w.inHeadHint, words: w.inHead });
  return {
    rows: [row],
    update(page) {
      const root = page.layout;
      const direct = root.type === 'sheet' && !!root.head && (root as SheetNode).children.some((child) => child.id === id && child.type === 'tabs');
      row.hidden = !direct;
      const tabs = tabsNodes(page).find((t) => t.id === id);
      inHead.checked = tabs?.place === 'head';
    },
  };
}

/** A field's access key: a letter of its label, with Alt. */
export function fieldHotkeySetting(el: ElementFactory, designer: Designer, id: string): SettingRows {
  const w = designer.words.head;
  const key = box(el, w.accessKey, { maxlength: '1', class: 'fd-input fd-hotkey-input', placeholder: 'E', spellcheck: 'false' });
  key.addEventListener('change', () => designer.setFieldHotkey(id, key.value || null));
  const row = setting(el, 'content', 'Access key, with Alt', key, { hint: w.accessKeyHint, words: w.accessKey });
  return {
    rows: [row],
    update(page) {
      const node = findNode(page, id)?.node;
      if (node?.type === 'field' && !focused(key)) key.value = (node.hotkey ?? '').toUpperCase();
    },
  };
}

/** The related lists a tab holds, in its groups and tabs of its own, in their order: what its count may count. */
function relatedListsIn(nodes: readonly LayoutNode[]): RelatedNode[] {
  return nodes.flatMap((node) => (node.type === 'related' ? [node] : node.type === 'section' ? relatedListsIn(node.children) : node.type === 'tabs' ? relatedListsIn(node.children.flatMap((tab) => tab.children)) : []));
}
