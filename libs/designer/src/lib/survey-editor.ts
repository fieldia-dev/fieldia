import { createForm, type FieldNode, type Form, type Page, type StepNode, type WizardNode } from '@fieldia/core';
import type { Skin } from '@fieldia/viewer';
import { createWidget, installStyles, type Widget } from '@fieldia/widgets';
import { branchMap, drawBranchMap } from './branch-map';
import { canvasDrag } from './canvas-drag';
import { designerBar, elementFactory, iconButton as makeIconButton, optionsEditor, type ElementFactory, type OptionsEditor } from './chrome';
import { conditionEditor } from './condition-editor';
import { kindOfField, QUESTION_KINDS, type Designer, type DesignerState, type Where } from './designer';
import type { FindItem } from './find-anything';
import { designerIcon } from './icons';
import { kindById } from './kinds';
import { openMenu, type MenuItem } from './menu';
import { rail as sideRail } from './rail';
import { installDesignerStyles } from './styles';
import { toolbox, TOOLBOX_GROUPS } from './toolbox';
import { tryIt } from './try-it';

/**
 * The survey editor, the Google Forms way: on a tinted page, a card heading
 * the form with its title and description, then each page's card and its
 * questions, each shown as people will see it — a text question as a dotted
 * line saying what goes there. The question picked opens into a card to
 * edit: its words in a filled box whose line grows from the middle, its kind
 * from a menu with icons, its options typed in place, a Required switch, and
 * ⋮ for its description, when it shows and moving it. Beside the card picked,
 * a small bar adds a question or a page after it, following it down the page.
 * A toolbox of the kinds a survey asks sits on the left; questions are
 * dragged within and between pages; Try it shows the survey working as
 * people will answer it. Plain DOM, so a framework binding is a thin shell
 * around it, like the viewer's.
 *
 * Every card and page is keyed by id and patched in place, so typing in a
 * label or an option keeps its focus while the page updates around it.
 */

export interface SurveyEditorOptions {
  designer: Designer;
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

/** What a text question's dotted line says: the kind of answer that goes there. */
const PREVIEW_WORDS: Record<string, string> = {
  'short-answer': 'Short answer text',
  paragraph: 'Long answer text',
  email: 'Email address',
  phone: 'Phone number',
  website: 'Web address',
  number: 'A number',
  amount: 'An amount',
  keywords: 'Keywords',
};

/** A box whose line grows from the middle when it is typed in, the Google Forms way. */
const lined = (el: ElementFactory, input: HTMLElement, extra = '') => el('span', { class: `fd-line ${extra}`.trim() }, input);

export function mountSurveyEditor(host: HTMLElement, options: SurveyEditorOptions): SurveyEditorHandle {
  const { designer } = options;
  const doc = host.ownerDocument;
  installStyles(doc);
  installDesignerStyles(doc);

  const el = elementFactory(doc);
  const iconButton = (label: string, text: string, onClick: () => void, extra = '') => makeIconButton(el, label, text, onClick, extra);
  const focused = (node: Element) => doc.activeElement === node;

  const skin = options.skin ?? 'outlined';
  const root = el('div', { class: 'fd-form fd-designer fd-survey-designer', 'data-fd-skin': skin });
  const trial = tryIt({ el, doc, designer, skin, onChange: (trying) => (body.hidden = trying) });
  const bar = designerBar(root, designer, {
    titleLabel: 'Form title',
    placeholder: 'Untitled form',
    extra: [trial.toggle],
    find: () => [...findItems(), ...trial.items()],
    // A check about a question's words or options: its card is open by now, the cursor goes there.
    goTo(id, part) {
      const card = root.querySelector(`.fd-q[data-node="${id}"]`);
      const target = card?.querySelector<HTMLInputElement>(part === 'label' ? '.fd-q-label' : '.fd-q-option input');
      target?.focus();
      target?.select();
    },
  });
  const pages = el('div', { class: 'fd-designer-pages' });
  const addPage = el('button', { type: 'button', class: 'fd-button' }, 'Add page');
  addPage.addEventListener('click', () => {
    const count = stepsOf(designer.getPage()).length;
    designer.addContainer(`Page ${count + 1}`);
  });

  // The card heading the form: its title and description, as people will see them.
  const headTitle = el('input', { class: 'fd-survey-head-title', 'aria-label': 'Form heading', placeholder: 'Untitled form', autocomplete: 'off' }) as HTMLInputElement;
  headTitle.addEventListener('input', () => designer.setPageInfo({ title: headTitle.value }));
  const headDescription = el('input', { class: 'fd-survey-head-description', 'aria-label': 'Form description', placeholder: 'Form description', autocomplete: 'off' }) as HTMLInputElement;
  headDescription.addEventListener('input', () => designer.setPageInfo({ description: headDescription.value }));
  const head = el('div', { class: 'fd-survey-head' }, lined(el, headTitle), lined(el, headDescription));
  head.addEventListener('focusin', () => designer.getState().selected !== null && designer.select(null));

  // Beside the card picked, following it down the page: a question after it, or a page.
  const railQuestion = el('button', { type: 'button', class: 'fd-rail-button', 'aria-label': 'Add a question after this one', title: 'Add question' }, designerIcon(doc, 'plus'));
  const railPage = el('button', { type: 'button', class: 'fd-rail-button', 'aria-label': 'Add a page after this one', title: 'Add page' }, designerIcon(doc, 'section'));
  const rail = el('div', { class: 'fd-q-rail', role: 'toolbar', 'aria-label': 'Add' }, railQuestion, railPage);
  railQuestion.addEventListener('click', () => add('short-answer', railTarget()));
  railPage.addEventListener('click', addPageHere);

  // Where answers lead: the pages on one line, those for some answers off it.
  const mapScroll = el('div', { class: 'fd-branch-scroll' });
  const map = el('details', { class: 'fd-branch-map', open: '', hidden: '' }, el('summary', { class: 'fd-branch-summary' }, 'Where answers lead'), mapScroll);
  let mapKey = '';
  function drawMap(page: Page, selected: string | null) {
    const drawn = branchMap(page);
    map.hidden = drawn.nodes.length < 2;
    const key = JSON.stringify([drawn, selected]);
    if (map.hidden || key === mapKey) return;
    mapKey = key;
    mapScroll.replaceChildren(
      drawBranchMap(doc, drawn, selected, (id) => {
        designer.select(id);
        stepViews.get(id)?.element.scrollIntoView?.({ block: 'nearest' });
      })
    );
  }

  const column = el('div', { class: 'fd-survey-column' }, head, map, pages, addPage, rail);
  const editor = el('div', { class: 'fd-designer-editor fd-survey-canvas' }, column);
  const tools = toolbox({
    el,
    doc,
    kinds: QUESTION_KINDS,
    onPick: (spec) => add(spec.slice(spec.indexOf(':') + 1), target()),
    onPress: (spec, event, tile) => drag.press({ tool: spec }, event, tile),
  });
  const side = sideRail({
    el,
    doc,
    designer,
    tools,
    survey: true,
    reveal: (id) => root.querySelector(`[data-node="${id}"]`)?.scrollIntoView?.({ block: 'nearest' }),
  });
  const body = el('div', { class: 'fd-designer-body fd-survey-body' }, side.element, editor);
  root.append(bar.element, bar.issues, body, trial.element);

  // ---- find anything -----------------------------------------------------------
  /** A kind to add, a question or a page to go to, a page to add. */
  function findItems(): FindItem[] {
    const page = designer.getPage();
    const steps = stepsOf(page);
    const goTo = (id: string, selector: string) => {
      designer.select(id);
      const box = root.querySelector<HTMLInputElement>(selector);
      box?.focus();
      box?.setSelectionRange(box.value.length, box.value.length);
    };
    return [
      ...QUESTION_KINDS.map((kind) => ({ label: `Add a question: ${kind.label}`, hint: 'new question', run: () => add(kind.id, target()) })),
      ...steps.flatMap((step) =>
        step.children
          .filter((n): n is FieldNode => n.type === 'field')
          .map((node) => ({ label: `Go to “${page.fields[node.field]?.label ?? node.id}”`, hint: step.label, run: () => goTo(node.id, '.fd-q-selected .fd-q-label') }))
      ),
      ...steps.map((step) => ({ label: `Go to the page “${step.label}”`, hint: 'page', run: () => goTo(step.id, `.fd-design-step[data-node="${step.id}"] .fd-step-title`) })),
      { label: 'Add a page', hint: 'page', run: () => addPage.click() },
    ];
  }

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
  /** Where the bar beside the card picked adds a question: after the question, at the top of the page, or at the top of the form. */
  function railTarget(): Where {
    const page = designer.getPage();
    const selected = designer.getState().selected;
    const steps = stepsOf(page);
    if (selected && steps.some((s) => s.children.some((n) => n.id === selected))) return { after: selected };
    const step = steps.find((s) => s.id === selected) ?? steps[0];
    return { parent: step.id, index: 0 };
  }
  /** A page after the question picked, the questions under it going with it; or a page at the end. */
  function addPageHere() {
    const page = designer.getPage();
    const selected = designer.getState().selected;
    const question = selected && stepsOf(page).some((s) => s.children.some((n) => n.id === selected)) ? selected : null;
    const created = designer.addContainer(`Page ${stepsOf(page).length + 1}`, question ? { after: question } : {});
    if (!created) return;
    designer.select(created);
    const title = stepViews.get(created)?.element.querySelector<HTMLInputElement>('.fd-step-title');
    title?.focus();
    title?.select();
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
      /** Something else was painted in the box: the next paint starts afresh. */
      reset() {
        widget = null;
        painted = '';
      },
      destroy: () => widget?.destroy?.(),
    };
  }

  /**
   * How a question's answer reads before anyone answers it: a text question as
   * a dotted line saying what goes there, a dropdown as its numbered options,
   * anything else as its real answer box. Null for the real box.
   */
  function preview(page: Page, node: FieldNode): HTMLElement | null {
    const def = page.fields[node.field];
    const kind = kindOfField(def, node);
    if (kind && PREVIEW_WORDS[kind]) return el('div', { class: `fd-q-preview fd-q-preview-${kind === 'paragraph' ? 'long' : 'short'}` }, PREVIEW_WORDS[kind]);
    if (kind === 'dropdown' && def.type === 'selection') return el('ol', { class: 'fd-q-preview fd-q-preview-list' }, ...def.options.map((o, i) => el('li', {}, `${i + 1}. ${o.label}`)));
    return null;
  }
  /** Paints a question's answer into a box: the preview where there is one, else the real answer box. */
  function answerBox(box: HTMLElement, id: string) {
    const painter = answerPainter(box, id);
    let previewKey = '';
    return {
      paint(page: Page, node: FieldNode) {
        const shown = preview(page, node);
        if (!shown) {
          previewKey = '';
          return painter.paint(page, node);
        }
        const key = shown.outerHTML;
        if (key === previewKey) return;
        previewKey = key;
        painter.destroy();
        box.replaceChildren(shown);
        painter.reset();
      },
      destroy: () => painter.destroy(),
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
    const painter = answerBox(answer, id);
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
    const grip = el('button', { type: 'button', class: 'fd-q-grip', 'data-grip': '', 'aria-label': 'Drag to move', title: 'Drag to move · Ctrl+Shift+K or J moves it too' }, designerIcon(doc, 'grip'));
    const label = el('input', { class: 'fd-q-label', 'aria-label': 'Question', autocomplete: 'off', placeholder: 'Question' }) as HTMLInputElement;
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
      // Google Forms' menu: a row for each kind, its icon first, the groups between lines.
      const items: MenuItem[] = TOOLBOX_GROUPS.flatMap(([, ids]) => ids.filter((k) => offered.has(k)).map((k, i) => ({ id: k, label: kindById(k).label, icon: k, checked: k === current, ...(i === 0 ? { divider: true } : {}) })));
      openMenu({ el, anchor: kind, title: 'Kind of question', items, roomy: true, onPick: (k) => designer.changeKind(id, k) });
    });
    const help = el('input', { class: 'fd-q-help', 'aria-label': 'Description', placeholder: 'Description', autocomplete: 'off' }) as HTMLInputElement;
    help.addEventListener('input', () => designer.updateQuestion(id, { help: help.value }));
    const helpBox = lined(el, help, 'fd-q-help-box');
    /** A description asked for from ⋮, still empty: shown until the card closes. */
    let wantHelp = false;
    // Enter goes on to the description; with Ctrl and Shift it is the editor's, a question after this one.
    const plainEnter = (event: KeyboardEvent) => event.key === 'Enter' && !event.ctrlKey && !event.metaKey;
    label.addEventListener('keydown', (event) => {
      if (plainEnter(event)) {
        event.preventDefault();
        if (helpBox.hidden) label.blur();
        else help.focus();
      }
    });
    help.addEventListener('keydown', (event) => {
      if (plainEnter(event)) {
        event.preventDefault();
        help.blur();
      }
    });
    const choices: OptionsEditor = optionsEditor(el, designer, id);
    const answer = el('div', { class: 'fd-q-answer', inert: '' });
    const painter = answerBox(answer, id);
    const when = conditionEditor(el, designer, id, 'question');
    const tool = (label: string, icon: string, onClick: () => void, extra = '') => {
      const button = el('button', { type: 'button', class: `fd-q-tool ${extra}`.trim(), 'aria-label': label, title: label }, designerIcon(doc, icon));
      button.addEventListener('click', onClick);
      return button;
    };
    const required = el('button', { type: 'button', class: 'fd-switch', role: 'switch', 'aria-checked': 'false', 'aria-label': 'Required' });
    required.addEventListener('click', () => designer.updateQuestion(id, { required: required.getAttribute('aria-checked') !== 'true' }));
    const moreButton = tool('More options', 'kebab', () => openMore());
    moreButton.setAttribute('aria-haspopup', 'menu');
    moreButton.setAttribute('aria-expanded', 'false');
    // ⋮: the description, when it shows, and moving it — what Google Forms keeps there.
    function openMore() {
      const page = designer.getPage();
      const step = stepsOf(page).find((s) => s.children.some((n) => n.id === id));
      const at = step ? step.children.findIndex((n) => n.id === id) : -1;
      const hasHelp = !helpBox.hidden;
      const items: MenuItem[] = [
        { id: 'help', label: 'Description', checked: hasHelp },
        ...(when.element.hidden && when.canStart() ? [{ id: 'when', label: 'Show only when…' }] : []),
        ...(at > 0 ? [{ id: 'up', label: 'Move up', divider: true }] : []),
        ...(step && at !== -1 && at < step.children.length - 1 ? [{ id: 'down', label: 'Move down', ...(at > 0 ? {} : { divider: true }) }] : []),
      ];
      openMenu({
        el,
        anchor: moreButton,
        title: 'More options',
        items,
        actions: true,
        onPick(item) {
          if (item === 'help') {
            if (hasHelp) {
              wantHelp = false;
              designer.updateQuestion(id, { help: '' });
              helpBox.hidden = true;
            } else {
              wantHelp = true;
              helpBox.hidden = false;
              help.focus();
            }
          } else if (item === 'when') when.start();
          else if (item === 'up') designer.moveNode(id, -1);
          else if (item === 'down') designer.moveNode(id, 1);
        },
      });
    }
    const foot = el(
      'div',
      { class: 'fd-q-foot' },
      tool('Duplicate', 'duplicate', () => {
        const copy = designer.duplicateNode(id);
        if (copy) designer.select(copy);
      }),
      tool('Delete', 'delete', () => designer.removeNode(id), 'fd-q-tool-danger'),
      el('span', { class: 'fd-q-sep', 'aria-hidden': 'true' }),
      el('span', { class: 'fd-q-required-words', 'aria-hidden': 'true' }, 'Required'),
      required,
      moreButton
    );
    const element = el(
      'div',
      { class: 'fd-q fd-q-selected fd-editing', 'data-node': id },
      grip,
      el('div', { class: 'fd-q-head' }, lined(el, label, 'fd-q-label-box'), kind),
      helpBox,
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
        helpBox.hidden = !def.help && !wantHelp;
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
    const name = el('input', { class: 'fd-step-title', 'aria-label': 'Page title', placeholder: 'Untitled page', autocomplete: 'off' }) as HTMLInputElement;
    name.addEventListener('input', () => designer.renameContainer(id, name.value));
    name.addEventListener('focus', () => designer.getState().selected !== id && designer.select(id));
    const removeStep = iconButton('Delete page', '✕', () => designer.removeNode(id), 'fd-icon-danger');
    const when = conditionEditor(el, designer, id, 'page');
    const condition = el('div', { class: 'fd-step-when' }, when.element);
    const cards = el('div', { class: 'fd-step-cards', 'data-drop-section': id, 'data-drop-flow': 'column' });
    const addQuestion = el('button', { type: 'button', class: 'fd-button fd-button-link fd-add-question' }, designerIcon(doc, 'short-answer'), 'Add question');
    addQuestion.setAttribute('aria-label', 'Add question');
    addQuestion.addEventListener('click', () => add('short-answer', { parent: id }));
    // The page's own card, its number on a tab over it, as Google Forms heads a section.
    section.append(el('header', { class: 'fd-step-head' }, number, el('div', { class: 'fd-step-head-row' }, lined(el, name, 'fd-step-title-box'), removeStep), condition), cards, addQuestion);

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
    if (trial.trying || event.defaultPrevented) return;
    const selected = designer.getState().selected;
    if (!selected || !cardViews.has(selected)) return;
    const typing = target.closest('input, textarea, select, [contenteditable]');
    // Google Forms' keys, typing or not: a question after this one, a copy of it, up and down.
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey) {
      const chord = event.key.toLowerCase();
      const run =
        chord === 'enter'
          ? () => add('short-answer', { after: selected })
          : chord === 'd'
            ? () => {
                const copy = designer.duplicateNode(selected);
                if (copy) designer.select(copy);
              }
            : chord === 'k' || chord === 'j'
              ? () => designer.moveNode(selected, chord === 'k' ? -1 : 1)
              : null;
      if (run) {
        event.preventDefault();
        run();
        return;
      }
    }
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
  function render(state: DesignerState) {
    const page = state.page;
    const steps = stepsOf(page);
    bar.update(state);
    tools.update({ modelFields: [], tabs: false });
    side.update(state);
    if (!focused(headTitle)) headTitle.value = page.title ?? '';
    drawMap(page, state.selected);
    if (!focused(headDescription)) headDescription.value = page.description ?? '';

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
    placeRail();
  }

  /** The bar beside the card picked, level with its top: a question's card, a page's, or the form's own. */
  function placeRail() {
    const selected = designer.getState().selected;
    const beside = (selected && (cardViews.get(selected)?.element ?? stepViews.get(selected)?.element.querySelector<HTMLElement>('.fd-step-head'))) || head;
    const top = beside.getBoundingClientRect().top - column.getBoundingClientRect().top;
    rail.style.setProperty('--fd-rail-y', `${Math.max(0, Math.round(top))}px`);
  }
  // Cards above it grow and shrink as they are edited, and the window changes size: the bar keeps level.
  const watcher = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => placeRail());
  watcher?.observe(column);

  host.append(root);
  const leave = designer.subscribe(render);
  render(designer.getState());

  return {
    element: root,
    destroy() {
      leave();
      watcher?.disconnect();
      bar.destroy();
      drag.destroy();
      doc.removeEventListener('keydown', onKey);
      for (const view of cardViews.values()) view.destroy();
      trial.destroy();
      root.remove();
    },
  };
}
