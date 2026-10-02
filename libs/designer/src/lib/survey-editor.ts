import { createMemoryDataSource, type FieldNode, type Page, type StepNode, type WizardNode } from '@fieldia/core';
import { mountViewer, type Skin, type ViewerHandle } from '@fieldia/viewer';
import { installStyles } from '@fieldia/widgets';
import { designerBar, elementFactory, iconButton as makeIconButton, optionsEditor } from './chrome';
import { kindOfField, QUESTION_KINDS, type Designer, type DesignerState } from './designer';
import { conditionEditor } from './condition-editor';
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

/** The kind a question was made as. The same as the designer's `kindOfField`, under the name it had first. */
export const kindOfQuestion = kindOfField;

/** Choices a later page can depend on: single choices and yes-or-no questions. */
/** The questions before one, on earlier pages and earlier on its own: the ones its condition may test. */
function questionsBefore(page: Page, id: string): FieldNode[] {
  const all = (page.layout as WizardNode).children.flatMap((step) => step.children.filter((n): n is FieldNode => n.type === 'field'));
  const at = all.findIndex((n) => n.id === id);
  return at === -1 ? all : all.slice(0, at);
}

export function mountSurveyEditor(host: HTMLElement, options: SurveyEditorOptions): SurveyEditorHandle {
  const { designer } = options;
  const doc = host.ownerDocument;
  installStyles(doc);
  installDesignerStyles(doc);

  const el = elementFactory(doc);
  const iconButton = (label: string, text: string, onClick: () => void, extra = '') => makeIconButton(el, label, text, onClick, extra);
  const focused = (node: Element) => doc.activeElement === node;

  const root = el('div', { class: 'fd-form fd-designer', 'data-fd-skin': options.skin ?? 'outlined' });

  const bar = designerBar(root, designer, { titleLabel: 'Form title', placeholder: 'Untitled form' });
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
  root.append(bar.element, bar.issues, body);

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

    const options = optionsEditor(el, designer, id);

    const requiredBox = el('input', { type: 'checkbox' }) as HTMLInputElement;
    requiredBox.addEventListener('change', () => designer.updateQuestion(id, { required: requiredBox.checked }));
    const required = el('label', { class: 'fd-q-required' }, requiredBox, el('span', {}, 'Required'));
    const help = el('input', { class: 'fd-input fd-q-help', 'aria-label': 'Help text', placeholder: 'Help text (optional)' }) as HTMLInputElement;
    help.addEventListener('input', () => designer.updateQuestion(id, { help: help.value }));
    const when = conditionEditor(el, designer, id, 'question');
    const showWhen = el('button', { type: 'button', class: 'fd-button fd-button-link fd-q-when' }, 'Show only when…');
    showWhen.addEventListener('click', () => when.start());
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
    card.append(el('div', { class: 'fd-q-head' }, label, kind), options.element, when.element, el('div', { class: 'fd-q-foot' }, required, help, showWhen, tools));
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
        options.update(field);
        when.update(page, questionsBefore(page, node.id), node.invisible);
        showWhen.hidden = !when.element.hidden || !when.canStart();
      },
    };
  }

  function makeStep(id: string): StepView {
    const section = el('section', { class: 'fd-design-step', 'data-node': id });
    const name = el('input', { class: 'fd-input fd-step-title', 'aria-label': 'Page title' }) as HTMLInputElement;
    name.addEventListener('input', () => designer.renameContainer(id, name.value));
    const removeStep = iconButton('Delete page', '✕', () => designer.removeNode(id), 'fd-icon-danger');
    const when = conditionEditor(el, designer, id, 'page');
    const condition = el('div', { class: 'fd-step-when' }, when.element);
    const cards = el('div', { class: 'fd-step-cards' });
    const addQuestion = el('button', { type: 'button', class: 'fd-button fd-button-link' }, 'Add question');
    addQuestion.addEventListener('click', () => {
      const created = designer.addQuestion('short-answer', { parent: id });
      if (created) focusLabelOf = created;
      render(designer.getState());
    });
    section.append(el('header', { class: 'fd-step-head' }, name, removeStep), condition, cards, addQuestion);

    return {
      element: section,
      cards,
      update(page, step, index, total) {
        if (!focused(name)) name.value = step.label;
        removeStep.hidden = total === 1;
        // Only questions on earlier pages can decide whether this one shows.
        const earlier = (page.layout as WizardNode).children.slice(0, index).flatMap((s) => s.children.filter((n): n is FieldNode => n.type === 'field'));
        condition.hidden = index === 0;
        when.update(page, earlier, step.invisible);
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
    // Busy until drawn again: what is in it now is about to go.
    previewHost.setAttribute('aria-busy', 'true');
    previewTimer = setTimeout(() => {
      previewHost.removeAttribute('aria-busy');
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
    bar.update(state);

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
      bar.destroy();
      clearTimeout(previewTimer);
      previewHandle?.destroy();
      root.remove();
    },
  };
}
