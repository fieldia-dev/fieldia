import type { FieldNode, LayoutNode, Page } from '@fieldia/core';
import type { DesignerAssistant } from './assistant';
import { assistantBox, type AssistantBox } from './assistant-box';
import { openAssistantDialog } from './assistant-dialog';
import type { ElementFactory } from './chrome';
import type { Designer, DesignerState } from './designer';
import type { FindItem } from './find-anything';
import { designerIcon } from './icons';
import { kindOfField } from './kinds';
import { isBlank, type PageTemplate } from './templates';
import { doneNotice, type DoneNotice } from './templates-notice';
import { setHidden } from './writes';

/**
 * The empty state: above a blank survey or screen, "Start from a template" —
 * each template a button with its title, what it is for, and its first
 * questions with their kinds' pictures — and Start blank, which puts the
 * offer away. Picking one is one edit, said in a notice with Undo beside it;
 * undone, the offer is back to pick another. The first part added puts the
 * offer away too. With the app's assistant, a box to describe the form sits
 * under the templates, and once the page has parts, "Ask the assistant…" is
 * in Find anything. An editor places `element` once, above the page.
 */

export interface StartOptions {
  el: ElementFactory;
  doc: Document;
  designer: Designer;
  /** A survey's questions, or a screen's fields: the words it uses. */
  survey: boolean;
  /** The editor's own templates, after the designer's. */
  templates?: readonly PageTemplate[];
  /** Where the cursor goes for Start blank: what adds the first part. */
  blankFocus(): HTMLElement | null;
  /** The app's assistant; without one, nothing about it shows. */
  assistant?: DesignerAssistant | null;
  /** Where a dialog opens: the editor's own element. */
  root: HTMLElement;
}

export interface StartHere {
  /** The notice, then the offer. */
  element: HTMLElement;
  /** The notice, for other whole-page edits to speak through. */
  notice: DoneNotice;
  /** For Find anything: each template, while the page is blank. */
  items(): FindItem[];
  update(state: DesignerState): void;
}

/** How many of a template's questions its button shows. */
const PREVIEWED = 3;
let made = 0;

/** The fields a page shows, in order. */
function fieldsOf(page: Page): FieldNode[] {
  const walk = (nodes: LayoutNode[]): FieldNode[] => nodes.flatMap((n) => (n.type === 'field' ? [n] : 'children' in n && Array.isArray(n.children) ? walk(n.children as LayoutNode[]) : []));
  return page.layout.type === 'list' ? [] : walk(page.layout.children as LayoutNode[]);
}

export function startHere(options: StartOptions): StartHere {
  const { el, doc, designer } = options;
  const assistant = options.assistant ?? null;
  const w = designer.words.templates;
  const a = designer.words.assistant;
  const id = `fd-start-${++made}`;
  const list = el('ul', { class: 'fd-start-list', role: 'list' });
  const blank = el('button', { type: 'button', class: 'fd-button fd-start-blank' }, w.startBlank);
  const panel = el(
    'section',
    { class: 'fd-start', 'aria-labelledby': `${id}-title`, hidden: '' },
    el(
      'div',
      { class: 'fd-start-head' },
      el('h2', { class: 'fd-start-title', id: `${id}-title` }, w.startTitle),
      el('p', { class: 'fd-start-lead' }, w.lead(options.survey, !!assistant))
    ),
    list
  );
  const notice = doneNotice(el, designer, () => {
    // Undone: the offer is back, its first template ready for the keyboard.
    if (!panel.hidden) list.querySelector<HTMLButtonElement>('.fd-start-card')?.focus();
  });
  /** What the assistant did, said with Undo. */
  const saidDone = (changes: string[], wasBlank: boolean) => notice.show(wasBlank ? a.built : a.changed, changes);
  const box: AssistantBox | null = assistant
    ? assistantBox({
        el,
        designer,
        assistant,
        label: a.describe,
        placeholder: a.describeExample(options.survey),
        ask: a.build,
        busy: a.building,
        onApplied: saidDone,
        onSettled: () => update(designer.getState()),
      })
    : null;
  if (box) panel.append(box.element);
  panel.append(el('div', { class: 'fd-start-foot' }, blank));
  const element = el('div', { class: 'fd-start-area' }, notice.element, panel);
  /** Put away for good, by Start blank. */
  let dismissed = false;
  let drawn = '';

  /** The designer's templates, then the editor's own made the same way: each once. */
  function offered(): PageTemplate[] {
    const survey = designer.getPage().layout.type === 'wizard';
    const seen = new Set<string>();
    return [...designer.templates(), ...(options.templates ?? []).filter((t) => (t.page.layout.type === 'wizard') === survey)].filter((t) => !seen.has(t.id) && !!seen.add(t.id));
  }
  function pick(template: PageTemplate) {
    if (designer.replacePage(template.page)) notice.show(w.started(template.title));
  }
  function preview(template: PageTemplate): HTMLElement {
    const fields = fieldsOf(template.page);
    const rows = fields.slice(0, PREVIEWED).map((node) => {
      const def = template.page.fields[node.field];
      return el('span', { class: 'fd-start-preview-row' }, designerIcon(doc, kindOfField(def, node) ?? 'short-answer'), el('bdi', { class: 'fd-start-preview-label' }, node.label ?? def.label));
    });
    const more = fields.length > PREVIEWED ? [el('span', { class: 'fd-start-preview-more' }, w.andMore(fields.length - PREVIEWED))] : [];
    return el('span', { class: 'fd-start-preview', 'aria-hidden': 'true' }, ...rows, ...more);
  }
  function draw(templates: PageTemplate[]) {
    const key = templates.map((t) => t.id).join('|');
    if (key === drawn) return;
    drawn = key;
    list.replaceChildren(
      ...templates.map((template, i) => {
        const described = `${id}-${i}`;
        // Named by its title, described by what it is for: its first questions are for the eye.
        const button = el(
          'button',
          { type: 'button', class: 'fd-start-card', 'data-template': template.id, 'aria-labelledby': `${described}-title`, 'aria-describedby': described },
          // Each in its own direction, as the app wrote it.
          el('span', { class: 'fd-start-card-title', id: `${described}-title` }, el('bdi', {}, template.title)),
          el('span', { class: 'fd-start-card-description', id: described }, el('bdi', {}, template.description)),
          preview(template)
        );
        button.addEventListener('click', () => pick(template));
        return el('li', { class: 'fd-start-item' }, button);
      })
    );
  }
  blank.addEventListener('click', () => {
    dismissed = true;
    panel.hidden = true;
    options.blankFocus()?.focus();
  });

  /** On show while the page is blank, and while its box waits for the assistant. */
  const showing = (page: Page) => (!dismissed && isBlank(page) && offered().length > 0) || !!box?.busy;
  function update(state: DesignerState) {
    notice.update(state);
    const visible = showing(state.page);
    setHidden(panel, !visible);
    if (visible) draw(offered());
  }
  return {
    element,
    notice,
    items() {
      if (showing(designer.getPage())) return offered().map((template) => ({ label: w.startFrom(template.title), hint: w.template, run: () => pick(template) }));
      if (!assistant) return [];
      const ask = () => openAssistantDialog({ el, root: options.root, designer, assistant, onApplied: (changes) => saidDone(changes, false) });
      return [{ label: a.askItem, hint: assistant.name ?? a.hint, run: ask }];
    },
    update,
  };
}
