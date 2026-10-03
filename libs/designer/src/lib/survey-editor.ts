import { createForm, createMemoryDataSource, type FieldNode, type Form, type Page, type StepNode, type WizardNode } from '@fieldia/core';
import { mountViewer, type Skin, type ViewerHandle } from '@fieldia/viewer';
import { createWidget, installStyles, type Widget } from '@fieldia/widgets';
import { canvasDrag } from './canvas-drag';
import { designerBar, elementFactory, iconButton as makeIconButton, optionsEditor, type OptionsEditor } from './chrome';
import { conditionEditor } from './condition-editor';
import { kindOfField, QUESTION_KINDS, type Designer, type DesignerState, type Where } from './designer';
import { designerIcon } from './icons';
import { kindById } from './kinds';
import { openMenu, type MenuItem } from './menu';
import { installDesignerStyles } from './styles';
import { toolbox, TOOLBOX_GROUPS } from './toolbox';

/**
 * The survey editor, the Google Forms way: pages of questions, each shown as
 * people will see it, and the one picked opened into a card to edit — its
 * words, its kind from a menu with icons, its options typed in place, when it
 * shows, and a Required switch. A toolbox of the kinds a survey asks sits on
 * the left; questions are dragged within and between pages. Plain DOM, so a
 * framework binding is a thin shell around it, like the viewer's.
 *
 * Every card and page is keyed by id and patched in place, so typing in a
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

/** The questions before one, on earlier pages and earlier on its own: the ones its condition may test. */
function questionsBefore(page: Page, id: string): FieldNode[] {
  const all = (page.layout as WizardNode).children.flatMap((step) => step.children.filter((n): n is FieldNode => n.type === 'field'));
  const at = all.findIndex((n) => n.id === id);
  return at === -1 ? all : all.slice(0, at);
}

const stepsOf = (page: Page) => (page.layout as WizardNode).children;

export function mountSurveyEditor(host: HTMLElement, options: SurveyEditorOptions): SurveyEditorHandle {
  const { designer } = options;
  const doc = host.ownerDocument;
  installStyles(doc);
  installDesignerStyles(doc);

  const el = elementFactory(doc);
  const iconButton = (label: string, text: string, onClick: () => void, extra = '') => makeIconButton(el, label, text, onClick, extra);
  const focused = (node: Element) => doc.activeElement === node;

  const root = el('div', { class: 'fd-form fd-designer fd-survey-designer', 'data-fd-skin': options.skin ?? 'outlined' });
  const bar = designerBar(root, designer, { titleLabel: 'Form title', placeholder: 'Untitled form' });
  const pages = el('div', { class: 'fd-designer-pages' });
  const addPage = el('button', { type: 'button', class: 'fd-button' }, 'Add page');
  addPage.addEventListener('click', () => {
    const count = stepsOf(designer.getPage()).length;
    designer.addContainer(`Page ${count + 1}`);
  });
  const editor = el('div', { class: 'fd-designer-editor' }, pages, addPage);
  const tools = toolbox({
    el,
    doc,
    kinds: QUESTION_KINDS,
    onPick: (spec) => add(spec.slice(spec.indexOf(':') + 1), target()),
    onPress: (spec, event, tile) => drag.press({ tool: spec }, event, tile),
  });
  const previewHost = el('div', { class: 'fd-designer-preview-host' });
  const preview = el('aside', { class: 'fd-designer-preview', 'aria-label': 'Preview' }, el('div', { class: 'fd-designer-preview-title' }, 'Preview'), previewHost);
  const body = el('div', { class: 'fd-designer-body fd-survey-body' }, tools.element, editor, ...(options.preview === false ? [] : [preview]));
  root.append(bar.element, bar.issues, body);

  // ---- adding ------------------------------------------------------------------
  /** The question just added, whose words take the cursor once it is drawn. */
  let focusLabelOf: string | null = null;
  /** Where a question picked in the toolbox goes: after the one picked, or at the end of the page picked, or of the last page. */
  function target(): Where {
    const page = designer.getPage();
    const selected = designer.getState().selected;
    const steps = stepsOf(page);
    if (selected && steps.some((s) => s.children.some((n) => n.id === selected))) return { after: selected };
    if (selected && steps.some((s) => s.id === selected)) return { parent: selected };
    return { parent: steps[steps.length - 1].id };
  }
  function add(kind: string, where: Where) {
    const created = designer.addQuestion(kind, where);
    if (!created) return;
    focusLabelOf = created;
    render(designer.getState());
  }
  const drag = canvasDrag({
    canvas: editor,
    cards: '.fd-q[data-node]',
    drop: (source, step, index) => {
      if ('tool' in source) add(source.tool.slice(source.tool.indexOf(':') + 1), { parent: step, index });
      else if (designer.placeNode(source.node, step, index)) designer.select(source.node);
    },
  });

  // ---- questions -----------------------------------------------------------------
  interface CardView {
    element: HTMLElement;
    open: boolean;
    update(page: Page, node: FieldNode): void;
    destroy(): void;
  }
  const cardViews = new Map<string, CardView>();
  let drawn: { page: Page; form: Form } | null = null;
  const formFor = (page: Page) => (drawn?.page === page ? drawn.form : (drawn = { page, form: createForm({ page }) }).form);

  /** The question's real answer box, inert: here it is looked at, not answered. */
  function answerPainter(box: HTMLElement, id: string) {
    let widget: Widget | null = null;
    let painted = '';
    return {
      paint(page: Page, node: FieldNode) {
        const def = page.fields[node.field];
        const key = JSON.stringify([node, def]);
        if (key === painted && widget) return;
        painted = key;
        widget?.destroy?.();
        const form = formFor(page);
        widget = createWidget({ form, name: node.field, field: def, node, id: `fd-design-${id}`, document: doc });
        widget.update({ value: form.getState().values[node.field], values: form.getState().values, readonly: false, required: def.required === true, invalid: false });
        box.replaceChildren(widget.element);
      },
      destroy: () => widget?.destroy?.(),
    };
  }

  /** A question not picked: as people will see it. */
  function closedCard(id: string): CardView {
    const text = el('span', { class: 'fd-q-text' });
    const title = el('div', { class: 'fd-q-title' }, text);
    const help = el('div', { class: 'fd-help' });
    const answer = el('div', { class: 'fd-q-answer', inert: '' });
    const note = el('span', { class: 'fd-q-when-note' }, 'Shown only for some answers');
    const element = el('div', { class: 'fd-q fd-q-closed', 'data-node': id }, title, help, answer);
    const painter = answerPainter(answer, id);
    element.addEventListener('click', (event) => {
      if (designer.getState().selected === id) return;
      const onWords = (event.target as Element).closest('.fd-q-text');
      designer.select(id);
      // Clicking its words opens it with the cursor in them.
      if (onWords) {
        const words = cardViews.get(id)?.element.querySelector<HTMLInputElement>('.fd-q-label');
        words?.focus();
        words?.setSelectionRange(words.value.length, words.value.length);
      }
    });
    return {
      element,
      open: false,
      update(page, node) {
        const def = page.fields[node.field];
        text.textContent = def.label;
        element.classList.toggle('fd-required', def.required === true);
        help.textContent = def.help ?? '';
        help.hidden = !def.help;
        if (node.invisible !== undefined) title.append(note);
        else note.remove();
        painter.paint(page, node);
      },
      destroy: () => painter.destroy(),
    };
  }

  /** The question picked: open to edit, the Google Forms way. */
  function openCard(id: string): CardView {
    const grip = el('button', { type: 'button', class: 'fd-q-grip', 'data-grip': '', 'aria-label': 'Drag to move', title: 'Drag to move · Alt+↑ or ↓ moves it too' }, designerIcon(doc, 'grip'));
    const label = el('input', { class: 'fd-input fd-q-label', 'aria-label': 'Question', autocomplete: 'off' }) as HTMLInputElement;
    label.addEventListener('input', () => designer.updateQuestion(id, { label: label.value }));
    const kindIcon = el('span', { class: 'fd-q-kind-icon' });
    const kindName = el('span', { class: 'fd-q-kind-name' });
    const kind = el('button', { type: 'button', class: 'fd-q-kind', 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, kindIcon, kindName, designerIcon(doc, 'chevron'));
    kind.addEventListener('click', () => {
      const page = designer.getPage();
      const node = stepsOf(page).flatMap((s) => s.children).find((n): n is FieldNode => n.id === id && n.type === 'field');
      if (!node) return;
      const current = kindOfField(page.fields[node.field], node);
      const offered = new Set(designer.kindsFor(id).map((k) => k.id));
      const items: MenuItem[] = TOOLBOX_GROUPS.flatMap(([title, ids]) =>
        ids.filter((k) => offered.has(k)).map((k, i) => ({ id: k, label: kindById(k).label, icon: k, checked: k === current, ...(i === 0 ? { heading: title } : {}) }))
      );
      openMenu({ el, anchor: kind, title: 'Kind of question', items, onPick: (k) => designer.changeKind(id, k) });
    });
    const help = el('input', { class: 'fd-input fd-q-help', 'aria-label': 'Description', placeholder: 'Description (optional)', autocomplete: 'off' }) as HTMLInputElement;
    help.addEventListener('input', () => designer.updateQuestion(id, { help: help.value }));
    label.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        help.focus();
      }
    });
    help.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        help.blur();
      }
    });
    const choices: OptionsEditor = optionsEditor(el, designer, id);
    const answer = el('div', { class: 'fd-q-answer', inert: '' });
    const painter = answerPainter(answer, id);
    const when = conditionEditor(el, designer, id, 'question');
    const showWhen = el('button', { type: 'button', class: 'fd-button fd-button-link fd-q-when' }, 'Show only when…');
    showWhen.addEventListener('click', () => when.start());
    const up = iconButton('Move up', '↑', () => designer.moveNode(id, -1));
    const down = iconButton('Move down', '↓', () => designer.moveNode(id, 1));
    const required = el('button', { type: 'button', class: 'fd-switch', role: 'switch', 'aria-checked': 'false', 'aria-label': 'Required' });
    required.addEventListener('click', () => designer.updateQuestion(id, { required: required.getAttribute('aria-checked') !== 'true' }));
    const foot = el(
      'div',
      { class: 'fd-q-foot' },
      showWhen,
      el('span', { class: 'fd-spacer' }),
      up,
      down,
      iconButton('Duplicate', '⧉', () => {
        const copy = designer.duplicateNode(id);
        if (copy) designer.select(copy);
      }),
      iconButton('Delete', '✕', () => designer.removeNode(id), 'fd-icon-danger'),
      el('span', { class: 'fd-q-sep', 'aria-hidden': 'true' }),
      el('span', { class: 'fd-q-required-words', 'aria-hidden': 'true' }, 'Required'),
      required
    );
    const element = el(
      'div',
      { class: 'fd-q fd-q-selected fd-editing', 'data-node': id },
      grip,
      el('div', { class: 'fd-q-head' }, label, kind),
      help,
      choices.element,
      answer,
      when.element,
      foot
    );
    return {
      element,
      open: true,
      update(page, node) {
        const def = page.fields[node.field];
        if (!focused(label)) label.value = def.label;
        if (!focused(help)) help.value = def.help ?? '';
        const current = kindOfQuestion(def, node);
        const name = current ? kindById(current).label : 'Custom';
        kind.setAttribute('aria-label', `Kind of question: ${name}`);
        if (kindName.textContent !== name) {
          kindName.textContent = name;
          kindIcon.replaceChildren(designerIcon(doc, current ?? 'short-answer'));
        }
        required.setAttribute('aria-checked', String(def.required === true));
        choices.update(def);
        answer.hidden = !choices.element.hidden;
        if (!answer.hidden) painter.paint(page, node);
        when.update(page, questionsBefore(page, node.id), node.invisible);
        showWhen.hidden = !when.element.hidden || !when.canStart();
        const step = stepsOf(page).find((s) => s.children.some((n) => n.id === id));
        const at = step ? step.children.findIndex((n) => n.id === id) : -1;
        up.hidden = at <= 0;
        down.hidden = !step || at === step.children.length - 1;
      },
      destroy: () => painter.destroy(),
    };
  }

  // ---- pages ----------------------------------------------------------------------
  interface StepView {
    element: HTMLElement;
    cards: HTMLElement;
    update(page: Page, step: StepNode, index: number, total: number): void;
  }
  const stepViews = new Map<string, StepView>();

  function makeStep(id: string): StepView {
    const section = el('section', { class: 'fd-design-step', 'data-node': id });
    const number = el('span', { class: 'fd-step-number' });
    const name = el('input', { class: 'fd-input fd-step-title', 'aria-label': 'Page title' }) as HTMLInputElement;
    name.addEventListener('input', () => designer.renameContainer(id, name.value));
    name.addEventListener('focus', () => designer.getState().selected !== id && designer.select(id));
    const removeStep = iconButton('Delete page', '✕', () => designer.removeNode(id), 'fd-icon-danger');
    const when = conditionEditor(el, designer, id, 'page');
    const condition = el('div', { class: 'fd-step-when' }, when.element);
    const cards = el('div', { class: 'fd-step-cards', 'data-drop-section': id, 'data-drop-flow': 'column' });
    const addQuestion = el('button', { type: 'button', class: 'fd-button fd-button-link fd-add-question' }, designerIcon(doc, 'short-answer'), 'Add question');
    addQuestion.setAttribute('aria-label', 'Add question');
    addQuestion.addEventListener('click', () => add('short-answer', { parent: id }));
    section.append(el('header', { class: 'fd-step-head' }, number, name, removeStep), condition, cards, addQuestion);

    return {
      element: section,
      cards,
      update(page, step, index, total) {
        number.textContent = `Page ${index + 1} of ${total}`;
        if (!focused(name)) name.value = step.label;
        removeStep.hidden = total === 1;
        section.classList.toggle('fd-step-selected', designer.getState().selected === id);
        // Only questions on earlier pages can decide whether this one shows.
        const earlier = stepsOf(page).slice(0, index).flatMap((s) => s.children.filter((n): n is FieldNode => n.type === 'field'));
        condition.hidden = index === 0;
        when.update(page, earlier, step.invisible);
      },
    };
  }

  // ---- the keyboard ---------------------------------------------------------------
  // On the document: a click on a page leaves focus on the body, and keys pressed then never reach the editor's own element.
  const onKey = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (target !== doc.body && !root.contains(target)) return;
    if (event.defaultPrevented) return;
    const selected = designer.getState().selected;
    if (!selected || !cardViews.has(selected)) return;
    const typing = target.closest('input, textarea, select, [contenteditable]');
    if (event.key === 'Escape') {
      // Escape leaves the box being typed in and puts the question down.
      (typing as HTMLElement | null)?.blur();
      designer.select(null);
      return;
    }
    if (typing) return;
    if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      designer.moveNode(selected, event.key === 'ArrowUp' ? -1 : 1);
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      designer.removeNode(selected);
    }
  };
  doc.addEventListener('keydown', onKey);

  // ---- render ----------------------------------------------------------------------
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
    const steps = stepsOf(page);
    bar.update(state);
    tools.update({ modelFields: [], tabs: false });

    const liveSteps = new Set(steps.map((s) => s.id));
    for (const [id, view] of stepViews) {
      if (liveSteps.has(id)) continue;
      view.element.remove();
      stepViews.delete(id);
    }
    const liveCards = new Set(steps.flatMap((s) => s.children.map((n) => n.id)));
    for (const [id, view] of cardViews) {
      if (liveCards.has(id) && view.open === (state.selected === id)) continue;
      view.destroy();
      view.element.remove();
      cardViews.delete(id);
    }

    steps.forEach((step, index) => {
      let view = stepViews.get(step.id);
      if (!view) stepViews.set(step.id, (view = makeStep(step.id)));
      if (pages.children[index] !== view.element) pages.insertBefore(view.element, pages.children[index] ?? null);
      view.update(page, step, index, steps.length);
      const fields = step.children.filter((n): n is FieldNode => n.type === 'field');
      fields.forEach((node, at) => {
        let card = cardViews.get(node.id);
        if (!card) cardViews.set(node.id, (card = state.selected === node.id ? openCard(node.id) : closedCard(node.id)));
        if (view.cards.children[at] !== card.element) view.cards.insertBefore(card.element, view.cards.children[at] ?? null);
        card.update(page, node);
      });
      while (view.cards.children.length > fields.length) view.cards.lastElementChild?.remove();
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
      drag.destroy();
      doc.removeEventListener('keydown', onKey);
      clearTimeout(previewTimer);
      for (const view of cardViews.values()) view.destroy();
      previewHandle?.destroy();
      root.remove();
    },
  };
}
