import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import type { FindItem } from './find-anything';
import { designerIcon } from './icons';
import { checkJson, fixJson, type JsonRow } from './json-checks';
import { codeBox } from './json-code';
import type { TryIt } from './try-it';

/**
 * The JSON view: the page as it is saved, beside Design and Try it, for a
 * person who knows the format. What is typed is checked as it is typed, each
 * problem listed under the text with its line — a click puts the cursor
 * there — and a fix where the checks have one. Apply (Ctrl/⌘+Enter) makes
 * the text the page, as one step Undo takes back; leaving with changes not
 * applied asks first, in the page.
 */

export interface JsonViewOptions {
  el: ElementFactory;
  doc: Document;
  designer: Designer;
  /** Try it: the JSON button joins its Design and Try it, and each of them leaves the JSON. */
  trial: TryIt;
  /** The editor, hidden while the JSON shows. */
  body: HTMLElement;
}

export interface JsonView {
  element: HTMLElement;
  readonly open: boolean;
  /** For Find anything: the JSON, or the way back to designing. */
  items(): FindItem[];
  destroy(): void;
}

const SEVERITY: Record<JsonRow['severity'], string> = { error: 'Cannot apply', must: 'Must fix', should: 'Should fix' };
/** How long typing rests before the text is checked, in milliseconds. */
const REST = 250;
let count = 0;

/** `<>`: code, drawn as the designer's other icons are. */
function codeIcon(doc: Document): SVGSVGElement {
  const icon = designerIcon(doc, 'edit');
  icon.innerHTML = '<path d="M8.5 7L3.5 12l5 5M15.5 7l5 5-5 5"/>';
  return icon;
}

export function jsonView({ el, doc, designer, trial, body }: JsonViewOptions): JsonView {
  const id = `fd-json-${++count}`;
  const mac = /Mac|iPhone|iPad/.test(doc.defaultView?.navigator.platform ?? '');
  const chord = mac ? '⌘' : 'Ctrl+';
  const toggle = el('button', { type: 'button', class: 'fd-mode-button', 'data-mode': 'json', 'aria-pressed': 'false', title: 'The page as JSON' }, codeIcon(doc), 'JSON');
  trial.toggle.append(toggle);
  const mode = (name: string) => trial.toggle.querySelector<HTMLButtonElement>(`[data-mode="${name}"]`);

  const state = el('p', { class: 'fd-json-state', id: `${id}-state`, role: 'status' });
  const hint = el('p', { class: 'fd-json-hint', id: `${id}-hint` }, `Tab indents. To leave the box, press Esc, then Tab. ${chord}Enter applies.`);
  const code = codeBox(el, doc, { label: 'The page as JSON', describedBy: `${id}-state ${id}-hint`, onApply: () => applyNow() });
  const input = code.input;
  const copyButton = el('button', { type: 'button', class: 'fd-button' }, 'Copy JSON');
  const applyButton = el('button', { type: 'button', class: 'fd-button fd-button-primary', hidden: '' }, 'Apply');
  const bar = el(
    'div',
    { class: 'fd-json-bar' },
    el('div', { class: 'fd-json-title' }, el('h2', { class: 'fd-json-heading' }, 'The page as JSON'), state),
    el('div', { class: 'fd-json-actions' }, copyButton, applyButton)
  );
  // Leaving with changes not applied: asked here, in the page.
  const askApply = el('button', { type: 'button', class: 'fd-button fd-button-primary' }, 'Apply');
  const askDiscard = el('button', { type: 'button', class: 'fd-button' }, 'Discard');
  const askKeep = el('button', { type: 'button', class: 'fd-button' }, 'Keep editing');
  const question = el(
    'div',
    { class: 'fd-json-leave', role: 'alertdialog', 'aria-labelledby': `${id}-leave`, hidden: '' },
    el('p', { class: 'fd-json-leave-text', id: `${id}-leave` }, 'The changes typed here are not applied yet.'),
    el('div', { class: 'fd-json-actions' }, askApply, askDiscard, askKeep)
  );
  const list = el('ul', { class: 'fd-json-problems', 'aria-label': 'Problems' });
  const element = el('section', { class: 'fd-json', 'aria-label': 'The page as JSON', hidden: '' }, bar, question, code.element, hint, list);

  let open = false;
  /** The page as the text last matched it: untouched text follows the page as it changes. */
  let synced = '';
  let rows: JsonRow[] = [];
  let errors = 0;
  /** What was just done, said until the text changes again. */
  let said: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  /** Where to go once the question about changes not applied is answered. */
  let then: (() => void) | null = null;

  const dirty = () => input.value !== designer.pageJson();

  function check() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    ({ rows, errors } = checkJson(input.value));
    draw();
  }

  function draw() {
    code.refresh();
    code.mark(rows);
    drawState();
    list.replaceChildren(
      ...rows.map((row) => {
        const at = el('button', { type: 'button', class: 'fd-json-at', 'aria-label': `Go to line ${row.line}, column ${row.column}` }, `Line ${row.line}`);
        at.addEventListener('click', () => code.goTo(row));
        const item = el('li', { class: 'fd-json-problem', 'data-severity': row.severity }, at, el('span', { class: 'fd-json-severity' }, SEVERITY[row.severity]), el('span', { class: 'fd-json-message' }, row.message));
        if (row.fix) {
          const fix = el('button', { type: 'button', class: 'fd-button fd-button-link fd-json-fix' }, row.fix.label);
          fix.addEventListener('click', () => fixRow(row));
          item.append(fix);
        }
        return item;
      })
    );
  }

  /** Apply, and the line saying what there is to apply: kept current as each key is typed, the checks catching up once typing rests. */
  function drawState() {
    const changed = dirty();
    // Apply shows only when there is something it can do; otherwise the line says why not.
    applyButton.hidden = !changed || errors > 0;
    state.textContent =
      said ??
      (errors > 0
        ? `${errors} ${errors === 1 ? 'problem' : 'problems'} to put right before this can be applied.`
        : changed
          ? `Changed here, not applied yet: Apply or ${chord}Enter.`
          : 'Nothing to apply: the text is the page as it is.');
  }

  function fixRow(row: JsonRow) {
    const fixed = fixJson(input.value, row.fix?.check ?? null);
    said = fixed === null ? 'That fix cannot be made in the text as it is.' : 'Fixed in the text. Apply to keep it.';
    if (fixed !== null) code.replace(fixed);
    check();
  }

  /** Make the text the page. False, with its problems listed, when it cannot be. */
  function applyNow(): boolean {
    if (!dirty()) {
      said = null;
      check();
      return true;
    }
    const result = designer.setPageJson(input.value);
    if (result.ok) {
      synced = designer.pageJson();
      code.replace(synced);
      said = 'Applied. Undo takes it back.';
    } else said = null;
    check();
    return result.ok;
  }

  function pressed() {
    toggle.setAttribute('aria-pressed', String(open));
    mode('design')?.setAttribute('aria-pressed', String(!open && !trial.trying));
    mode('try')?.setAttribute('aria-pressed', String(!open && trial.trying));
  }

  function show() {
    if (open) return;
    if (trial.trying) mode('design')?.click();
    open = true;
    synced = designer.pageJson();
    code.replace(synced);
    input.setSelectionRange(0, 0);
    said = null;
    check();
    body.hidden = true;
    element.hidden = false;
    pressed();
    input.focus({ preventScroll: true });
  }

  function close() {
    open = false;
    then = null;
    question.hidden = true;
    element.hidden = true;
    body.hidden = false;
    pressed();
  }

  /** Leave, then go on: at once when nothing is left unapplied, after asking when something is. */
  function leave(next: () => void): boolean {
    if (!dirty()) {
      close();
      return false;
    }
    then = next;
    question.hidden = false;
    askApply.focus();
    return true;
  }

  const answered = (go: () => void) => {
    const next = then;
    close();
    go();
    next?.();
  };
  askApply.addEventListener('click', () => {
    if (applyNow()) answered(() => undefined);
    else {
      // Problems stop it: the question goes, and the first of them takes the keyboard.
      question.hidden = true;
      then = null;
      list.querySelector<HTMLButtonElement>('.fd-json-at')?.focus();
    }
  });
  askDiscard.addEventListener('click', () => answered(() => code.replace(designer.pageJson())));
  askKeep.addEventListener('click', () => {
    question.hidden = true;
    then = null;
    input.focus();
  });

  // Design and Try it leave the JSON: asked first when something typed is not applied yet.
  const onMode = (event: MouseEvent) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-mode]');
    if (!open || !button || button === toggle) return;
    if (leave(() => button.click())) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };
  trial.toggle.addEventListener('click', onMode, true);
  toggle.addEventListener('click', show);

  input.addEventListener('input', () => {
    said = null;
    drawState();
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(check, REST);
  });

  async function copy() {
    try {
      await (doc.defaultView?.navigator as Navigator).clipboard.writeText(input.value);
      said = 'Copied.';
    } catch {
      // No clipboard to write to: the text selected, for the person to copy.
      input.focus({ preventScroll: true });
      input.setSelectionRange(0, input.value.length);
      said = `Selected: press ${chord}C to copy.`;
    }
    draw();
  }
  copyButton.addEventListener('click', () => void copy());
  applyButton.addEventListener('click', () => applyNow());

  // Undo, redo or any edit elsewhere: text not typed in follows the page.
  const stop = designer.subscribe(() => {
    if (!open) return;
    const now = designer.pageJson();
    if (input.value === synced && now !== synced) {
      code.replace(now);
      said = null;
    }
    synced = now;
    check();
  });

  return {
    element,
    get open() {
      return open;
    },
    items() {
      if (open) return [{ label: 'Back to designing', hint: 'Design', run: () => mode('design')?.click() }];
      return [{ label: 'Edit the page as JSON', hint: 'JSON', run: () => toggle.click() }];
    },
    destroy() {
      if (timer !== null) clearTimeout(timer);
      stop();
      trial.toggle.removeEventListener('click', onMode, true);
      toggle.remove();
    },
  };
}
