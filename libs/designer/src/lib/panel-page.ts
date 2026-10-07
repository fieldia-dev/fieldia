import type { FieldNode, SheetNode } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { allSections } from './page-tree';
import { setting } from './panel-controls';
import { pageLookSettings } from './panel-look';
import type { PropertiesView } from './screen-properties';
import { formMoments } from './steps-panel';

/**
 * Nothing picked: the screen itself — its description and a sheet's title
 * (Content), whether it is sections or a record sheet and, for a sheet, what
 * sits around it — the pager and breadcrumbs the app gives, the attachment
 * and the side panel beside it (Layout) — its look (Look), and what it does
 * at its moments (Rules).
 */
export function pageProperties(el: ElementFactory, designer: Designer): PropertiesView {
  const focused = (node: Element) => node.ownerDocument.activeElement === node;
  const w = designer.words.panel;
  const description = el('textarea', { class: 'fd-input fd-insp-area', 'aria-label': w.description, rows: '2', placeholder: w.wordsUnderTitle });
  description.addEventListener('input', () => designer.setPageInfo({ description: description.value }));
  const layout = el('select', { class: 'fd-input fd-select', 'aria-label': w.layout }, el('option', { value: 'sections' }, w.sections), el('option', { value: 'sheet' }, w.recordSheet));
  layout.addEventListener('change', () => designer.setLayoutKind(layout.value as 'sections' | 'sheet'));
  const title = el('select', { class: 'fd-input fd-select', 'aria-label': w.titleField });
  title.addEventListener('change', () => designer.setTitleField(title.value === '' ? null : title.value === CURRENT_TITLE ? ((designer.getPage().layout as SheetNode).title?.field ?? null) : title.value));
  const titleRow = setting(el, 'content', 'Title field', title, { hint: w.titleFieldHint, words: w.titleField });
  const titleLabel = el('input', { class: 'fd-input', 'aria-label': w.titleLabel, placeholder: w.optional }) as HTMLInputElement;
  titleLabel.addEventListener('input', () => designer.setTitleLabel(titleLabel.value));
  const titleLabelRow = setting(el, 'content', 'Words over the title', titleLabel, { hint: w.titleLabelHint, words: w.titleLabel });
  // Around a record: the pager and the trail the app gives, shown unless the page says no; the attachment and the side panel beside it.
  const check = (label: string) => el('input', { type: 'checkbox', class: 'fd-check', 'aria-label': label }) as HTMLInputElement;
  const pager = check(w.pagerShown);
  pager.addEventListener('change', () => designer.setRecordToolbar({ pager: pager.checked }));
  const crumbs = check(w.breadcrumbsShown);
  crumbs.addEventListener('change', () => designer.setRecordToolbar({ breadcrumbs: crumbs.checked }));
  const pagerRow = setting(el, 'layout', 'Pager over the record', pager, { words: w.pagerShown });
  const crumbsRow = setting(el, 'layout', 'Breadcrumbs over the record', crumbs, { hint: w.aroundHint, words: w.breadcrumbsShown });
  const preview = el('select', { class: 'fd-input fd-select', 'aria-label': w.attachmentBeside }) as HTMLSelectElement;
  preview.addEventListener('change', () => designer.setAttachmentPreview(preview.value === NONE ? null : preview.value));
  const previewRow = setting(el, 'layout', 'Attachment beside the sheet', preview, { hint: w.attachmentHint, words: w.attachmentBeside });
  const beside = el('select', { class: 'fd-input fd-select', 'aria-label': w.sideBeside }, el('option', { value: 'wide' }, w.sideBesides.wide), el('option', { value: 'always' }, w.sideBesides.always)) as HTMLSelectElement;
  beside.addEventListener('change', () => designer.setSidePanelBeside(beside.value as 'wide' | 'always'));
  const besideRow = setting(el, 'layout', 'Side panel beside the sheet', beside, { words: w.sideBeside });
  const look = pageLookSettings(el, designer);
  // steps lane: what the form does at its moments — opened, saved or sent, a tab or step shown.
  const moments = formMoments(el, designer);
  const element = el(
    'div',
    { class: 'fd-props' },
    setting(el, 'content', 'Description', description, { words: w.description }),
    titleRow,
    titleLabelRow,
    el('p', { class: 'fd-properties-hint' }, w.nothingPicked),
    setting(el, 'layout', 'Layout', layout, { hint: w.layoutHint, words: w.layout }),
    pagerRow,
    crumbsRow,
    previewRow,
    besideRow,
    ...look.rows,
    moments.element
  );
  return {
    element,
    update(page) {
      if (!focused(description)) description.value = page.description ?? '';
      look.update(page);
      moments.update(page);
      const root = page.layout;
      layout.value = root.type === 'sheet' ? 'sheet' : 'sections';
      titleRow.hidden = root.type !== 'sheet';
      titleLabelRow.hidden = root.type !== 'sheet' || !root.title;
      pagerRow.hidden = crumbsRow.hidden = previewRow.hidden = root.type !== 'sheet';
      besideRow.hidden = root.type !== 'sheet' || !root.sidePanel;
      if (root.type !== 'sheet') return;
      pager.checked = root.toolbar?.pager !== false;
      crumbs.checked = root.toolbar?.breadcrumbs !== false;
      // The record's attachments from the app, or a file field's file.
      const files = [...Object.entries(page.fields), ...designer.modelFields().map((m) => [m.name, m.field] as const)].filter(([, f]) => f.type === 'binary' || f.type === 'image');
      const choices = [[NONE, w.attachmentNone], ['', w.attachmentFromApp], ...files.map(([name, f]) => [name, f.label] as const)];
      const key = JSON.stringify(choices);
      if (preview.dataset['choices'] !== key) {
        preview.dataset['choices'] = key;
        preview.replaceChildren(...choices.map(([value, words]) => el('option', { value }, words)));
      }
      preview.value = root.attachmentPreview ? (root.attachmentPreview.field ?? '') : NONE;
      beside.value = root.sidePanelBeside ?? 'wide';
      if (!focused(titleLabel)) titleLabel.value = root.title?.label ?? '';
      // The text fields that could be the title, and the one that is.
      const texts = allSections(page).flatMap((s) => s.children.filter((n): n is FieldNode => n.type === 'field' && page.fields[n.field]?.type === 'char'));
      title.replaceChildren(
        el('option', { value: '' }, w.noTitle),
        ...(root.title ? [el('option', { value: CURRENT_TITLE }, page.fields[root.title.field]?.label ?? root.title.field)] : []),
        ...texts.map((n) => el('option', { value: n.id }, n.label ?? page.fields[n.field].label))
      );
      title.value = root.title ? CURRENT_TITLE : '';
    },
  };
}

/** No attachment beside the sheet, in its list: '' is the app's attachments. */
const NONE = '#none';

/** The title's own entry in the list: it has no node, being out of every section. */
const CURRENT_TITLE = '#title';
