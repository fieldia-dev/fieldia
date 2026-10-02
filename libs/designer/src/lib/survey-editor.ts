import { createMemoryDataSource, type Field, type FieldNode, type Page, type StepNode, type WizardNode } from '@fieldia/core';
import { mountViewer, type Skin, type ViewerHandle } from '@fieldia/viewer';
import { installStyles } from '@fieldia/widgets';
import { QUESTION_KINDS, type Designer, type DesignerState } from './designer';
import { installDesignerStyles } from './styles';

/**
 * The survey editor: pages of question cards, top to bottom, with a live
 * preview — the Google Forms way of building a form. Plain DOM, so a
 * framework binding is a thin shell around it, like the viewer's.
 *
 * Every card and step is keyed by id and patched in place, so typing in a
 * label or an option keeps its focus while the page updates around it.
 */

export interface SurveyEditorOptions {
  designer: Designer;
  /** Show a live preview beside the editor. On by default. */
  preview?: boolean;
  skin?: Skin;
}

export interface SurveyEditorHandle {
  element: HTMLElement;
  destroy(): void;
}

/** Which question kind a field and its node are, for the kind picker. */
export function kindOfQuestion(field: Field, node: FieldNode): string | null {
  switch (field.type) {
    case 'char':
      return node.widget === 'email' ? 'email' : node.widget === 'phone' ? 'phone' : 'short-answer';
    case 'text':
      return 'paragraph';
    case 'selection':
      return field.multiple ? 'checkboxes' : node.widget === 'radio' ? 'multiple-choice' : 'dropdown';
    case 'integer':
      return node.widget === 'rating' ? 'rating' : node.widget === 'scale' ? 'scale' : 'number';
    case 'float':
    case 'monetary':
      return 'number';
    case 'date':
      return 'date';
    case 'datetime':
      return 'date-time';
    case 'boolean':
      return 'yes-no';
    case 'binary':
    case 'image':
      return 'file';
    default:
      return null;
  }
}

/** Choices a later page can depend on: single choices and yes-or-no questions. */
function choicesOf(field: Field): { value: string; label: string; literal: string | number | boolean }[] | null {
  if (field.type === 'selection' && !field.multiple) return field.options.map((o) => ({ value: String(o.value), label: o.label, literal: o.value }));
  if (field.type === 'boolean') return [{ value: 'true', label: 'Yes', literal: true }, { value: 'false', label: 'No', literal: false }];
  return null;
}

/** Read "q_1 != 'no'" or "q_1 != True" back into a field and a value. */
function readCondition(invisible: unknown): { field: string; value: string } | null {
  if (typeof invisible !== 'string') return null;
  const match = /^(\w+) != (?:'([^']*)'|(True|False)|(-?\d+(?:\.\d+)?))$/.exec(invisible);
  if (!match) return null;
  const value = match[2] ?? (match[3] ? (match[3] === 'True' ? 'true' : 'false') : match[4]);
  return { field: match[1], value };
}

export function mountSurveyEditor(host: HTMLElement, options: SurveyEditorOptions): SurveyEditorHandle {
  const { designer } = options;
  const doc = host.ownerDocument;
  installStyles(doc);
  installDesignerStyles(doc);

  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string | undefined> = {}, ...children: (Node | string)[]) => {
    const node = doc.createElement(tag);
    for (const [name, value] of Object.entries(attrs)) if (value !== undefined) node.setAttribute(name, value);
    node.append(...children);
    return node;
  };
  const iconButton = (label: string, text: string, onClick: () => void, extra = '') => {
    const b = el('button', { type: 'button', class: `fd-icon-button ${extra}`.trim(), 'aria-label': label, title: label }, text);
    b.addEventListener('click', onClick);
    return b;
  };
  const focused = (node: Element) => doc.activeElement === node;

  const root = el('div', { class: 'fd-form fd-designer', 'data-fd-skin': options.skin ?? 'outlined' });

  // ---- bar ---------------------------------------------------------------
  const title = el('input', { class: 'fd-input fd-designer-title', 'aria-label': 'Form title', placeholder: 'Untitled form' }) as HTMLInputElement;
  title.addEventListener('input', () => designer.setPageInfo({ title: title.value }));
  const status = el('span', { class: 'fd-designer-status', role: 'status' });
  const undo = el('button', { type: 'button', class: 'fd-button' }, 'Undo');
  const redo = el('button', { type: 'button', class: 'fd-button' }, 'Redo');
  const publish = el('button', { type: 'button', class: 'fd-button fd-button-primary' }, 'Publish');
  undo.addEventListener('click', () => designer.undo());
  redo.addEventListener('click', () => designer.redo());
  publish.addEventListener('click', () => void designer.publish().catch(() => undefined));
  const bar = el('div', { class: 'fd-designer-bar' }, title, status, el('span', { class: 'fd-spacer' }), undo, redo, publish);

  const issues = el('div', { class: 'fd-alert fd-tone-danger fd-designer-issues', role: 'alert', hidden: '' });
  const pages = el('div', { class: 'fd-designer-pages' });
  const addPage = el('button', { type: 'button', class: 'fd-button' }, 'Add page');
  addPage.addEventListener('click', () => {
    const count = (designer.getPage().layout as WizardNode).children.length;
    designer.addContainer(`Page ${count + 1}`);
  });
  const editor = el('div', { class: 'fd-designer-editor' }, pages, addPage);
  const previewHost = el('div', { class: 'fd-designer-preview-host' });
  const preview = el('aside', { class: 'fd-designer-preview', 'aria-label': 'Preview' }, el('div', { class: 'fd-designer-preview-title' }, 'Preview'), previewHost);
  const body = el('div', { class: 'fd-designer-body' }, editor, ...(options.preview === false ? [] : [preview]));
  root.append(bar, issues, body);

  // On the document: clicking an area that cannot take focus leaves focus on
  // the body, and keys pressed then never reach the editor's own element.
  const onKey = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (target !== doc.body && !root.contains(target)) return;
    const typing = target.closest('input, textarea, select, [contenteditable]');
    if (typing || !(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    if (key === 'z' && !event.shiftKey) {
      event.preventDefault();
      designer.undo();
    } else if ((key === 'z' && event.shiftKey) || key === 'y') {
      event.preventDefault();
      designer.redo();
    }
  };
  doc.addEventListener('keydown', onKey);

  // ---- cards ---------------------------------------------------------------
  interface CardView {
    element: HTMLElement;
    update(page: Page, node: FieldNode, selected: boolean): void;
  }
  interface StepView {
    element: HTMLElement;
    cards: HTMLElement;
    update(page: Page, step: StepNode, index: number, total: number): void;
  }
  const cardViews = new Map<string, CardView>();
  const stepViews = new Map<string, StepView>();
  let focusLabelOf: string | null = null;

  function makeCard(id: string): CardView {
    const card = el('div', { class: 'fd-q', 'data-node': id });
    const label = el('input', { class: 'fd-input fd-q-label', 'aria-label': 'Question' }) as HTMLInputElement;
    label.addEventListener('input', () => designer.updateQuestion(id, { label: label.value }));
    const kind = el('select', { class: 'fd-input fd-select fd-q-kind', 'aria-label': 'Kind of question' }) as HTMLSelectElement;
    for (const k of QUESTION_KINDS) kind.append(el('option', { value: k.id }, k.label));
    kind.addEventListener('change', () => designer.changeKind(id, kind.value));

    const optionList = el('ul', { class: 'fd-q-options' });
    const addOption = el('button', { type: 'button', class: 'fd-button fd-button-link' }, 'Add option');
    const optionBox = el('div', { class: 'fd-q-option-box' }, optionList, addOption);
    const optionLabels = () => [...optionList.querySelectorAll<HTMLInputElement>('input')].map((i) => i.value);
    addOption.addEventListener('click', () => {
      const labels = optionLabels();
      designer.setOptions(id, [...labels, `Option ${labels.length + 1}`]);
      (optionList.lastElementChild?.querySelector('input') as HTMLInputElement | null)?.focus();
    });

    const requiredBox = el('input', { type: 'checkbox' }) as HTMLInputElement;
    requiredBox.addEventListener('change', () => designer.updateQuestion(id, { required: requiredBox.checked }));
    const required = el('label', { class: 'fd-q-required' }, requiredBox, el('span', {}, 'Required'));
    const help = el('input', { class: 'fd-input fd-q-help', 'aria-label': 'Help text', placeholder: 'Help text (optional)' }) as HTMLInputElement;
    help.addEventListener('input', () => designer.updateQuestion(id, { help: help.value }));
    const tools = el(
      'div',
      { class: 'fd-q-tools' },
      iconButton('Move up', '↑', () => designer.moveNode(id, -1)),
      iconButton('Move down', '↓', () => designer.moveNode(id, 1)),
      iconButton('Duplicate', '⧉', () => {
        const copy = designer.duplicateNode(id);
        if (copy) designer.select(copy);
      }),
      iconButton('Delete', '✕', () => designer.removeNode(id), 'fd-icon-danger')
    );
    card.append(el('div', { class: 'fd-q-head' }, label, kind), optionBox, el('div', { class: 'fd-q-foot' }, required, help, tools));
    card.addEventListener('focusin', () => {
      if (designer.getState().selected !== id) designer.select(id);
    });
    card.addEventListener('click', () => {
      if (designer.getState().selected !== id) designer.select(id);
    });

    return {
      element: card,
      update(page, node, selected) {
        const field = page.fields[node.field];
        card.classList.toggle('fd-q-selected', selected);
        if (!focused(label)) label.value = field.label;
        const current = kindOfQuestion(field, node);
        kind.value = current ?? '';
        kind.disabled = current === null;
        requiredBox.checked = field.required === true;
        if (!focused(help)) help.value = field.help ?? '';
        const choices = field.type === 'selection' ? field.options : null;
        const multiple = field.type === 'selection' && field.multiple === true;
        optionBox.hidden = !choices;
        if (choices) {
          // Keep option rows by position, so typing in one keeps its focus.
          while (optionList.children.length > choices.length) optionList.lastElementChild?.remove();
          while (optionList.children.length < choices.length) {
            const index = optionList.children.length;
            const input = el('input', { class: 'fd-input', 'aria-label': `Option ${index + 1}` }) as HTMLInputElement;
            input.addEventListener('input', () => designer.setOptions(id, optionLabels()));
            const remove = iconButton('Remove option', '×', () => {
              const labels = optionLabels();
              labels.splice([...optionList.children].indexOf(remove.parentElement as Element), 1);
              designer.setOptions(id, labels);
            });
            optionList.append(el('li', { class: 'fd-q-option' }, el('span', { class: 'fd-q-bullet', 'aria-hidden': 'true' }, multiple ? '☐' : '◯'), input, remove));
          }
          choices.forEach((option, i) => {
            const row = optionList.children[i] as HTMLElement;
            const input = row.querySelector('input') as HTMLInputElement;
            if (!focused(input)) input.value = option.label;
            const remove = row.querySelector('button') as HTMLButtonElement;
            remove.setAttribute('aria-label', `Remove option ${option.label}`);
            remove.hidden = choices.length === 1;
            (row.querySelector('.fd-q-bullet') as HTMLElement).textContent = multiple ? '☐' : '◯';
          });
        }
      },
    };
  }

  function makeStep(id: string): StepView {
    const section = el('section', { class: 'fd-design-step', 'data-node': id });
    const name = el('input', { class: 'fd-input fd-step-title', 'aria-label': 'Page title' }) as HTMLInputElement;
    name.addEventListener('input', () => designer.renameContainer(id, name.value));
    const whenField = el('select', { class: 'fd-input fd-select fd-step-when-field', 'aria-label': 'Show this page' }) as HTMLSelectElement;
    const whenValue = el('select', { class: 'fd-input fd-select fd-step-when-value', 'aria-label': 'When the answer is' }) as HTMLSelectElement;
    const removeStep = iconButton('Delete page', '✕', () => designer.removeNode(id), 'fd-icon-danger');
    const condition = el('div', { class: 'fd-step-when' }, el('span', {}, 'Show this page'), whenField, whenValue);
    const cards = el('div', { class: 'fd-step-cards' });
    const addQuestion = el('button', { type: 'button', class: 'fd-button fd-button-link' }, 'Add question');
    addQuestion.addEventListener('click', () => {
      const created = designer.addQuestion('short-answer', { parent: id });
      if (created) focusLabelOf = created;
      render(designer.getState());
    });
    section.append(el('header', { class: 'fd-step-head' }, name, removeStep), condition, cards, addQuestion);

    const choose = () => {
      const page = designer.getPage();
      if (!whenField.value) return void designer.setCondition(id, null);
      const choices = choicesOf(page.fields[whenField.value]) ?? [];
      const pick = choices.find((c) => c.value === whenValue.value) ?? choices[0];
      if (pick) designer.setCondition(id, { field: whenField.value, equals: pick.literal });
    };
    whenField.addEventListener('change', choose);
    whenValue.addEventListener('change', choose);

    return {
      element: section,
      cards,
      update(page, step, index, total) {
        if (!focused(name)) name.value = step.label;
        removeStep.hidden = total === 1;
        // Only questions on earlier pages can decide whether this one shows.
        const earlier = (page.layout as WizardNode).children
          .slice(0, index)
          .flatMap((s) => s.children)
          .filter((n): n is FieldNode => n.type === 'field' && choicesOf(page.fields[n.field]) !== null);
        condition.hidden = index === 0;
        const current = readCondition(step.invisible);
        whenField.replaceChildren(el('option', { value: '' }, 'Always'), ...earlier.map((n) => el('option', { value: n.field }, page.fields[n.field].label)));
        whenField.value = current?.field ?? '';
        const choices = current ? choicesOf(page.fields[current.field]) ?? [] : [];
        whenValue.replaceChildren(...choices.map((c) => el('option', { value: c.value }, `is ${c.label}`)));
        whenValue.hidden = !current;
        if (current) whenValue.value = current.value;
      },
    };
  }

  // ---- render ----------------------------------------------------------------
  let previewTimer: ReturnType<typeof setTimeout> | undefined;
  let previewHandle: ViewerHandle | null = null;
  let previewedPage: Page | null = null;
  function refreshPreview(page: Page) {
    if (options.preview === false || page === previewedPage) return;
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      previewedPage = page;
      previewHandle?.destroy();
      previewHost.replaceChildren();
      try {
        previewHandle = mountViewer(previewHost, { page, dataSource: createMemoryDataSource(), skin: options.skin ?? 'outlined' });
      } catch (error) {
        previewHost.textContent = (error as Error).message;
      }
    }, 120);
  }

  function render(state: DesignerState) {
    const page = state.page;
    const steps = (page.layout as WizardNode).children;
    if (!focused(title)) title.value = page.title ?? '';
    undo.hidden = !state.canUndo;
    redo.hidden = !state.canRedo;
    publish.hidden = !state.unpublished;
    const last = state.versions[state.versions.length - 1];
    status.textContent = !last ? 'Draft, not published yet' : state.unpublished ? 'Changes not published yet' : `Published · version ${last.version}`;
    issues.hidden = state.issues.length === 0;
    issues.textContent = state.issues.join('\n');

    const liveSteps = new Set(steps.map((s) => s.id));
    for (const [id, view] of stepViews) {
      if (liveSteps.has(id)) continue;
      view.element.remove();
      stepViews.delete(id);
    }
    const liveCards = new Set(steps.flatMap((s) => s.children.map((n) => n.id)));
    for (const [id, view] of cardViews) {
      if (liveCards.has(id)) continue;
      view.element.remove();
      cardViews.delete(id);
    }

    steps.forEach((step, index) => {
      let view = stepViews.get(step.id);
      if (!view) stepViews.set(step.id, (view = makeStep(step.id)));
      if (pages.children[index] !== view.element) pages.insertBefore(view.element, pages.children[index] ?? null);
      view.update(page, step, index, steps.length);
      step.children.forEach((node, at) => {
        if (node.type !== 'field') return;
        let card = cardViews.get(node.id);
        if (!card) cardViews.set(node.id, (card = makeCard(node.id)));
        if (view.cards.children[at] !== card.element) view.cards.insertBefore(card.element, view.cards.children[at] ?? null);
        card.update(page, node, state.selected === node.id);
      });
    });
    if (focusLabelOf) {
      const label = cardViews.get(focusLabelOf)?.element.querySelector('.fd-q-label') as HTMLInputElement | undefined;
      // Select the placeholder text, so typing replaces it rather than adding to it.
      label?.focus();
      label?.select();
      focusLabelOf = null;
    }
    refreshPreview(page);
  }

  host.append(root);
  const leave = designer.subscribe(render);
  render(designer.getState());

  return {
    element: root,
    destroy() {
      leave();
      doc.removeEventListener('keydown', onKey);
      clearTimeout(previewTimer);
      previewHandle?.destroy();
      root.remove();
    },
  };
}
