import type { FieldNode, SheetNode } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { allSections } from './page-tree';
import { setting } from './panel-controls';
import { pageLookSettings } from './panel-look';
import type { PropertiesView } from './screen-properties';

/**
 * Nothing picked: the screen itself — its description and a sheet's title
 * (Content), whether it is sections or a record sheet (Layout), and its look
 * (Look).
 */
export function pageProperties(el: ElementFactory, designer: Designer): PropertiesView {
  const focused = (node: Element) => node.ownerDocument.activeElement === node;
  const description = el('textarea', { class: 'fd-input fd-insp-area', 'aria-label': 'Description', rows: '2', placeholder: 'Words under the title' });
  description.addEventListener('input', () => designer.setPageInfo({ description: description.value }));
  const layout = el('select', { class: 'fd-input fd-select', 'aria-label': 'Layout' }, el('option', { value: 'sections' }, 'Sections'), el('option', { value: 'sheet' }, 'Record sheet'));
  layout.addEventListener('change', () => designer.setLayoutKind(layout.value as 'sections' | 'sheet'));
  const title = el('select', { class: 'fd-input fd-select', 'aria-label': 'Title field' });
  title.addEventListener('change', () => designer.setTitleField(title.value === '' ? null : title.value === CURRENT_TITLE ? ((designer.getPage().layout as SheetNode).title?.field ?? null) : title.value));
  const titleRow = setting(el, 'content', 'Title field', title, { hint: 'The text field the record is named by, in big letters at the top.' });
  const look = pageLookSettings(el, designer);
  const element = el(
    'div',
    { class: 'fd-props' },
    setting(el, 'content', 'Description', description),
    titleRow,
    el('p', { class: 'fd-properties-hint' }, 'Nothing is picked, so these are the screen’s own settings. Pick a field or a section to change it.'),
    setting(el, 'layout', 'Layout', layout, { hint: 'A record sheet names its record at the top, and can have tabs, a status bar and buttons.' }),
    ...look.rows
  );
  return {
    element,
    update(page) {
      if (!focused(description)) description.value = page.description ?? '';
      look.update(page);
      const root = page.layout;
      layout.value = root.type === 'sheet' ? 'sheet' : 'sections';
      titleRow.hidden = root.type !== 'sheet';
      if (root.type !== 'sheet') return;
      // The text fields that could be the title, and the one that is.
      const texts = allSections(page).flatMap((s) => s.children.filter((n): n is FieldNode => n.type === 'field' && page.fields[n.field]?.type === 'char'));
      title.replaceChildren(
        el('option', { value: '' }, 'No title'),
        ...(root.title ? [el('option', { value: CURRENT_TITLE }, page.fields[root.title.field]?.label ?? root.title.field)] : []),
        ...texts.map((n) => el('option', { value: n.id }, n.label ?? page.fields[n.field].label))
      );
      title.value = root.title ? CURRENT_TITLE : '';
    },
  };
}

/** The title's own entry in the list: it has no node, being out of every section. */
const CURRENT_TITLE = '#title';
