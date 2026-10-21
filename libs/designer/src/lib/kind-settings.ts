import type { Field, FieldNode, Page } from '@fieldia/core';
import { appKindSettings } from './app-kinds-ui';
import { iconButton, type ElementFactory } from './chrome';
import { columnsEditor } from './columns-editor';
import type { Designer } from './designer';
import { ADDRESS_PARTS, USUAL_ADDRESS } from './kind-commands';
import { choiceSettings } from './kind-settings-choices';
import { LARGEST_PICTURE } from './choice-commands';
import { pictureForPage } from './picture-upload';
import { settingNumber, type SettingNumberOptions } from './number-box';

/**
 * The settings of the newer kinds, in the picked question itself, as the
 * older kinds have theirs: a slider's range and step, a picture for each
 * option, a matrix's rows and columns, an address's parts, a repeating
 * group's fields, least and most cards and words — and, for the choices,
 * a Shuffle switch and points for each option once the page is a quiz.
 */

export interface KindSettings {
  /** Each part flows in the settings' row; a wide part takes a row of its own. */
  elements: HTMLElement[];
  refresh(page: Page, node: FieldNode): void;
  /** The settings stand in for the answer box, as a matrix's rows and columns do. */
  standsIn: boolean;
}
type Part = Omit<KindSettings, 'elements'> & { element: HTMLElement };

/** Kinds whose options may be shown in an order of each form's own. */
const SHUFFLED = new Set(['multiple-choice', 'checkboxes', 'dropdown', 'image-choice', 'ranking']);
/** Kinds whose options may be worth points: a matrix's options are its columns. */
const SCORED = new Set(['multiple-choice', 'checkboxes', 'dropdown', 'image-choice', 'matrix']);
/** Kinds whose options may have places, counted by the app: a session's seats, an offer's stock. */
const SEATED = new Set(['multiple-choice', 'checkboxes', 'dropdown', 'image-choice']);
/** Kinds whose options may be a quiz's right answers: a choice's own. */
const MARKED = new Set(['multiple-choice', 'checkboxes', 'dropdown', 'image-choice']);
/** Kinds a quiz's answer is typed in, and the answers they take named: words, a number. */
const TYPED_ANSWER = new Set(['short-answer', 'number']);

const optionsOf = (field: Field) => (field.type === 'selection' ? field.options : field.type === 'matrix' ? field.columns : []);
/** A setting's number as the page holds it, or null. */
const held = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

export function kindSettings(el: ElementFactory, designer: Designer, id: string, kind: string | null): KindSettings | null {
  const w = designer.words.questions;
  const focused = (node: Element) => node.ownerDocument.activeElement === node;
  const word = (text: string, control: HTMLElement) => el('label', { class: 'fd-inline-setting' }, el('span', {}, text), control);
  /** The designer's number box: Arabic digits and a decimal comma read, kept as it is left, what does not fit said. */
  const numberBox = (options: SettingNumberOptions & { placeholder?: string }) =>
    settingNumber(el, designer, { ...options, attrs: { class: 'fd-inline-input fd-inline-number', ...(options.placeholder ? { placeholder: options.placeholder } : {}), ...options.attrs } });
  const textBox = (label: string, placeholder: string) => el('input', { class: 'fd-inline-input fd-inline-words', 'aria-label': label, placeholder, autocomplete: 'off' }) as HTMLInputElement;
  const toggle = (label: string, onClick: (on: boolean) => void) => {
    const button = el('button', { type: 'button', class: 'fd-switch', role: 'switch', 'aria-checked': 'false', 'aria-label': label }) as HTMLButtonElement;
    button.addEventListener('click', () => onClick(button.getAttribute('aria-checked') !== 'true'));
    return { button, element: el('span', { class: 'fd-inline-setting fd-inline-toggle' }, button, el('span', { 'aria-hidden': 'true' }, label)) };
  };
  /** A setting of the question's widget, from its node's options. */
  const optionOf = (node: FieldNode, key: string) => node.options?.[key];

  function slider(): Part {
    // Its ends as drawn — 0 to 100 unless said — each kept with the other once typed and left; its step more than 0, 1 unless said.
    let [least, most, by] = [0, 100, 1];
    const fromOptions: SettingNumberOptions = { label: w.from, saved: () => least, commit: (n) => designer.setLimits(id, { min: n, max: most }) };
    const toOptions: SettingNumberOptions = { label: w.toLabel, saved: () => most, commit: (n) => designer.setLimits(id, { min: least, max: n }) };
    const from = numberBox(fromOptions);
    const to = numberBox(toOptions);
    const stepping: SettingNumberOptions = { label: w.step, above: 0, optional: true, saved: () => by, commit: (n) => designer.setStep(id, n) };
    // A step with decimals makes the field a decimal, so the values it reaches are ones the field takes.
    const step = numberBox(stepping);
    return {
      element: el('div', { class: 'fd-inline-row' }, word(w.from, from.input), word(w.to, to.input), word(w.step, step.input)),
      standsIn: false,
      refresh(page, node) {
        const def = page.fields[node.field];
        // A whole-number field's ends are whole numbers.
        fromOptions.integer = toOptions.integer = def.type === 'integer';
        least = 'min' in def && typeof def.min === 'number' ? def.min : 0;
        most = 'max' in def && typeof def.max === 'number' ? def.max : 100;
        by = held(optionOf(node, 'step')) ?? 1;
        from.refresh();
        to.refresh();
        step.refresh();
      },
    };
  }

  function pictures(): Part {
    const list = el('ul', { class: 'fd-kind-pictures' });
    const several = toggle(w.severalAnswers, (on) => designer.setSeveral(id, on));
    const element = el('div', { class: 'fd-kind-block' }, el('span', { class: 'fd-prop-name' }, w.pictures), list, several.element);
    const rows: { thumb: HTMLElement; name: HTMLElement; address: HTMLInputElement; file: HTMLInputElement; alt: HTMLInputElement }[] = [];
    function row(index: number) {
      const thumb = el('span', { class: 'fd-kind-thumb' });
      const name = el('span', { class: 'fd-kind-picture-name' });
      const address = el('input', { class: 'fd-inline-input fd-kind-picture-address', placeholder: w.pictureAddress, autocomplete: 'off', spellcheck: 'false' }) as HTMLInputElement;
      // Kept once typed and left: a picture half typed is an address that is not there.
      address.addEventListener('change', () => designer.setOptionDetails(id, index, { image: address.value }));
      // Or a picture from this computer, kept in the page as a data: address: 1200 px wide at most, refused over 5 MB.
      const file = el('input', { type: 'file', accept: 'image/*', class: 'fd-sr-only', tabindex: '-1' }) as HTMLInputElement;
      file.addEventListener('change', () => {
        const chosen = file.files?.[0];
        file.value = '';
        if (!chosen) return;
        const keep = (src: string) => designer.setOptionPicture(id, index, { src, bytes: chosen.size });
        if (chosen.size > LARGEST_PICTURE) keep('');
        else void pictureForPage(chosen, file.ownerDocument).then(keep, () => keep(''));
      });
      // What it shows, for people who cannot see it.
      const alt = el('input', { class: 'fd-inline-input fd-kind-picture-alt', placeholder: w.pictureAlt, autocomplete: 'off' }) as HTMLInputElement;
      alt.addEventListener('input', () => designer.setOptionDetails(id, index, { alt: alt.value }));
      const upload = el('button', { type: 'button', class: 'fd-button fd-button-link fd-kind-upload' }, w.upload);
      upload.addEventListener('click', () => file.click());
      list.append(el('li', { class: 'fd-kind-picture' }, thumb, name, address, upload, file, alt));
      rows.push({ thumb, name, address, file, alt });
    }
    return {
      element,
      standsIn: false,
      refresh(page, node) {
        const def = page.fields[node.field];
        const options = optionsOf(def);
        while (rows.length > options.length) {
          rows.pop();
          list.lastElementChild?.remove();
        }
        while (rows.length < options.length) row(rows.length);
        options.forEach((option, i) => {
          const { thumb, name, address, alt } = rows[i];
          name.textContent = option.label;
          address.setAttribute('aria-label', w.pictureFor(option.label));
          alt.setAttribute('aria-label', w.pictureShows(option.label));
          alt.hidden = !option.image;
          if (!focused(alt)) alt.value = option.alt ?? '';
          const src = option.image ?? '';
          const shown = thumb.querySelector('img');
          if ((shown?.getAttribute('src') ?? '') !== src) thumb.replaceChildren(...(src ? [el('img', { src, alt: '' })] : []));
          // A picture uploaded is a long data: address: the box says so instead of showing it.
          if (!focused(address)) {
            const uploaded = src.startsWith('data:');
            address.value = uploaded ? '' : src;
            address.placeholder = uploaded ? w.uploaded : w.pictureAddress;
          }
        });
        several.button.setAttribute('aria-checked', String(def.type === 'selection' && def.multiple === true));
      },
    };
  }

  function matrix(): Part {
    const editors = (['rows', 'columns'] as const).map((which) => {
      const said = which === 'rows' ? { add: w.addRow, item: w.row, made: designer.words.defaults.row, remove: w.removeRow, removeNamed: w.removeRowNamed } : { add: w.addColumn, item: w.column, made: designer.words.defaults.column, remove: w.removeColumn, removeNamed: w.removeColumnNamed };
      const list = el('ul', { class: 'fd-kind-items' });
      const read = () => [...list.querySelectorAll('input')].map((input) => input.value);
      const save = () => designer.setMatrixItems(id, which, read());
      const add = el('button', { type: 'button', class: 'fd-button fd-button-link', [`data-add-${which}`]: '' }, said.add);
      const focusAt = (index: number) => {
        const input = list.querySelectorAll('input')[index] as HTMLInputElement | undefined;
        input?.focus();
        input?.select();
      };
      add.addEventListener('click', () => {
        const labels = read();
        if (designer.setMatrixItems(id, which, [...labels, said.made(labels.length + 1)])) focusAt(labels.length);
      });
      const element = el('div', { class: 'fd-kind-block' }, el('span', { class: 'fd-prop-name' }, which === 'rows' ? w.rows : w.columns), list, add);
      return {
        element,
        update(items: { label: string }[]) {
          while (list.children.length > items.length) list.lastElementChild?.remove();
          while (list.children.length < items.length) {
            const index = list.children.length;
            const input = el('input', { class: 'fd-inline-input fd-kind-item', 'aria-label': said.item(index + 1), autocomplete: 'off' }) as HTMLInputElement;
            // Emptied while typed in, it stays until the cursor leaves; then it goes.
            input.addEventListener('input', () => input.value.trim() && save());
            input.addEventListener('change', () => !input.value.trim() && save());
            input.addEventListener('keydown', (event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              const labels = read();
              labels.splice(index + 1, 0, said.made(labels.length + 1));
              if (designer.setMatrixItems(id, which, labels)) focusAt(index + 1);
            });
            const remove = iconButton(el, said.remove, '×', () => {
              const labels = read();
              labels.splice(index, 1);
              designer.setMatrixItems(id, which, labels);
            });
            list.append(el('li', { class: 'fd-kind-item-row' }, input, remove));
          }
          items.forEach((item, i) => {
            const row = list.children[i] as HTMLElement;
            const input = row.querySelector('input') as HTMLInputElement;
            if (!focused(input)) input.value = item.label;
            const remove = row.querySelector('button') as HTMLButtonElement;
            remove.setAttribute('aria-label', said.removeNamed(item.label));
            remove.title = remove.getAttribute('aria-label') ?? '';
            remove.hidden = items.length === 1;
          });
        },
      };
    });
    return {
      element: el('div', { class: 'fd-kind-matrix' }, ...editors.map((e) => e.element)),
      standsIn: true,
      refresh(page, node) {
        const def = page.fields[node.field];
        if (def.type !== 'matrix') return;
        editors[0].update(def.rows);
        editors[1].update(def.columns);
      },
    };
  }

  function address(): Part {
    let current: string[] = USUAL_ADDRESS;
    const chips = ADDRESS_PARTS.map((part) => {
      const chip = el('button', { type: 'button', class: 'fd-inline-chip', 'aria-pressed': 'true', 'data-part': part }, w.addressParts[part]) as HTMLButtonElement;
      chip.addEventListener('click', () => designer.setAddressParts(id, current.includes(part) ? current.filter((p) => p !== part) : [...current, part]));
      return { part, chip };
    });
    return {
      element: el('div', { class: 'fd-inline-row' }, el('span', {}, w.asksFor), el('div', { class: 'fd-inline-chips', role: 'group', 'aria-label': w.partsOfAddress }, ...chips.map((c) => c.chip))),
      standsIn: false,
      refresh(_page, node) {
        const parts = optionOf(node, 'parts');
        current = Array.isArray(parts) ? parts.filter((p): p is string => typeof p === 'string') : USUAL_ADDRESS;
        for (const { part, chip } of chips) chip.setAttribute('aria-pressed', String(current.includes(part)));
      },
    };
  }

  function repeating(): Part {
    const columns = columnsEditor(el, designer, id);
    // The table's column editor, for the fields of each card.
    const heading = columns.element.querySelector('.fd-prop-name');
    if (heading) heading.textContent = w.fieldsInCard;
    const addField = columns.element.querySelector('[data-add-column]');
    if (addField) addField.textContent = w.addField;
    // Whole numbers, at least 0 and at most 1 or more; emptied (or at least 0), none.
    const counts: Record<'min' | 'max', number | null> = { min: null, max: null };
    const count = (label: string, key: 'min' | 'max', min: number) =>
      numberBox({ label, integer: true, min, optional: true, saved: () => counts[key], commit: (n) => designer.setWidgetOptions(id, { [key]: n === 0 ? null : n }) });
    const least = count(w.atLeast, 'min', 0);
    const most = count(w.atMost, 'max', 1);
    const title = textBox(w.cardTitle, w.entry);
    const button = textBox(w.buttonWords, w.addAnother);
    title.addEventListener('input', () => designer.setWidgetOptions(id, { itemLabel: title.value }));
    button.addEventListener('input', () => designer.setWidgetOptions(id, { addLabel: button.value }));
    return {
      element: el(
        'div',
        { class: 'fd-kind-block' },
        columns.element,
        el('div', { class: 'fd-inline-row' }, word(w.atLeast, least.input), word(w.atMost, most.input)),
        el('div', { class: 'fd-inline-row' }, word(w.cardTitle, title), word(w.buttonWords, button))
      ),
      standsIn: true,
      refresh(page, node) {
        columns.update(page.fields[node.field]);
        const text = (input: HTMLInputElement, value: unknown) => !focused(input) && (input.value = value === undefined || value === null ? '' : String(value));
        counts.min = held(optionOf(node, 'min'));
        counts.max = held(optionOf(node, 'max'));
        least.refresh();
        most.refresh();
        text(title, optionOf(node, 'itemLabel'));
        text(button, optionOf(node, 'addLabel'));
      },
    };
  }

  function shuffle(): Part {
    const toggled = toggle(w.shuffle, (on) => designer.setWidgetOptions(id, { shuffle: on ? true : null }));
    return {
      element: toggled.element,
      standsIn: false,
      refresh(_page, node) {
        toggled.button.setAttribute('aria-checked', String(optionOf(node, 'shuffle') === true));
      },
    };
  }

  /** Points for each option once the page is a quiz — some option on it has points — and the way to make it one. */
  function points(): Part {
    const start = el('button', { type: 'button', class: 'fd-button fd-button-link fd-kind-give-points' }, w.givePoints);
    start.addEventListener('click', () => {
      if (designer.setOptionDetails(id, 0, { score: 0 })) (list.querySelector('input') as HTMLInputElement | null)?.focus();
    });
    const list = el('ul', { class: 'fd-kind-points' });
    const block = el('div', { class: 'fd-kind-block' }, el('span', { class: 'fd-prop-name' }, w.points), list);
    /** Each option's points box, kept as it is left: emptying one, or half typing it, never takes the quiz away under the keys. */
    const rows: { name: HTMLElement; input: HTMLInputElement; options: SettingNumberOptions; refresh(): void; score: number | null }[] = [];
    return {
      element: el('div', { class: 'fd-kind-points-box' }, start, block),
      standsIn: false,
      refresh(page, node) {
        const quiz = Object.values(page.fields).some((f) => optionsOf(f).some((o) => o.score !== undefined));
        // While one of its boxes is typed in, the block stays, so the box and what is typed in it do too.
        const typing = list.contains(list.ownerDocument.activeElement);
        start.hidden = quiz || typing;
        block.hidden = !quiz && !typing;
        const options = optionsOf(page.fields[node.field]);
        while (rows.length > options.length) {
          rows.pop();
          list.lastElementChild?.remove();
        }
        while (rows.length < options.length) {
          const index = rows.length;
          const name = el('span', { class: 'fd-kind-points-name' });
          const row = { name, score: null as number | null } as (typeof rows)[number];
          const options: SettingNumberOptions & { placeholder: string } = { label: w.points, optional: true, placeholder: '0', saved: () => row.score, commit: (n) => designer.setOptionDetails(id, index, { score: n }) };
          const box = numberBox(options);
          Object.assign(row, { input: box.input, options, refresh: box.refresh });
          list.append(el('li', { class: 'fd-kind-points-row' }, name, box.input));
          rows.push(row);
        }
        options.forEach((option, i) => {
          rows[i].name.textContent = option.label;
          rows[i].options.label = w.pointsFor(option.label);
          rows[i].input.setAttribute('aria-label', rows[i].options.label);
          rows[i].score = held(option.score);
          rows[i].refresh();
        });
      },
    };
  }

  /** Places for each option — a session's seats — once one has them, and the way to give them. */
  function places(): Part {
    const start = el('button', { type: 'button', class: 'fd-button fd-button-link fd-kind-give-places' }, w.givePlaces);
    start.addEventListener('click', () => {
      if (designer.setOptionDetails(id, 0, { seats: 10 })) (list.querySelector('input') as HTMLInputElement | null)?.focus();
    });
    const list = el('ul', { class: 'fd-kind-points fd-kind-places' });
    const block = el('div', { class: 'fd-kind-block' }, el('span', { class: 'fd-prop-name' }, w.places), list, el('p', { class: 'fd-properties-hint' }, w.placesHint));
    /** Each option's places box, kept as it is left: emptying one takes that option's places away, and no other's. */
    const rows: { name: HTMLElement; input: HTMLInputElement; options: SettingNumberOptions; refresh(): void; seats: number | null }[] = [];
    return {
      element: el('div', { class: 'fd-kind-points-box' }, start, block),
      standsIn: false,
      refresh(page, node) {
        const options = optionsOf(page.fields[node.field]);
        const typing = list.contains(list.ownerDocument.activeElement);
        const seated = options.some((o) => o.seats !== undefined);
        start.hidden = seated || typing;
        block.hidden = !seated && !typing;
        while (rows.length > options.length) {
          rows.pop();
          list.lastElementChild?.remove();
        }
        while (rows.length < options.length) {
          const index = rows.length;
          const name = el('span', { class: 'fd-kind-points-name' });
          const row = { name, seats: null as number | null } as (typeof rows)[number];
          const options: SettingNumberOptions & { placeholder: string } = { label: w.places, integer: true, min: 0, optional: true, placeholder: w.noLimit, saved: () => row.seats, commit: (n) => designer.setOptionDetails(id, index, { seats: n }) };
          const box = numberBox(options);
          Object.assign(row, { input: box.input, options, refresh: box.refresh });
          list.append(el('li', { class: 'fd-kind-points-row' }, name, box.input));
          rows.push(row);
        }
        options.forEach((option, i) => {
          rows[i].name.textContent = option.label;
          rows[i].options.label = w.placesFor(option.label);
          rows[i].input.setAttribute('aria-label', rows[i].options.label);
          rows[i].seats = held(option.seats);
          rows[i].refresh();
        });
      },
    };
  }

  /**
   * A quiz's question, once the page is a quiz (`quiz`): a choice's right answers ticked, or the answers a typed one
   * takes; its own points; what is said when right and when wrong. Each box kept as it is typed or left.
   */
  function quizQuestion(typed: boolean): Part {
    const list = el('ul', { class: 'fd-kind-points fd-kind-right' });
    const answers = textBox(w.answersTaken, w.answersTaken);
    answers.addEventListener('change', () => {
      const field = designer.getPage().fields[questionField()];
      const words = answers.value.split(',').map((one) => one.trim()).filter(Boolean);
      designer.setQuizQuestion(id, { answers: field?.type === 'char' ? words : words.map((one) => (Number.isFinite(Number(one.replace(',', '.'))) ? Number(one.replace(',', '.')) : one)) });
    });
    let worth: number | null = null;
    const points = numberBox({ label: w.questionPointsLabel, above: 0, optional: true, placeholder: '1', saved: () => worth, commit: (n) => designer.setQuizQuestion(id, { points: n }) });
    const right = textBox(w.feedbackRight, w.feedbackRight);
    right.addEventListener('input', () => designer.setQuizQuestion(id, { right: right.value }));
    const wrong = textBox(w.feedbackWrong, w.feedbackWrong);
    wrong.addEventListener('input', () => designer.setQuizQuestion(id, { wrong: wrong.value }));
    const marks: HTMLInputElement[] = [];
    const names: HTMLElement[] = [];
    const block = el(
      'div',
      { class: 'fd-kind-block fd-kind-quiz' },
      el('span', { class: 'fd-prop-name' }, typed ? w.answersTaken : w.rightAnswers),
      typed ? el('div', { class: 'fd-inline-row' }, answers) : list,
      el('p', { class: 'fd-properties-hint' }, typed ? w.answersTakenHint : w.rightHint),
      el('div', { class: 'fd-inline-row' }, word(w.questionPoints, points.input), word(w.feedbackRight, right), word(w.feedbackWrong, wrong))
    );
    let fieldName = '';
    const questionField = () => fieldName;
    return {
      element: block,
      standsIn: false,
      refresh(page, node) {
        fieldName = node.field;
        const def = page.fields[node.field];
        const quiz = (def as { quiz?: { points?: number; answers?: (string | number)[]; feedback?: { right?: string; wrong?: string } } }).quiz;
        block.hidden = !page.quiz;
        worth = held(quiz?.points);
        points.refresh();
        if (!focused(right)) right.value = quiz?.feedback?.right ?? '';
        if (!focused(wrong)) wrong.value = quiz?.feedback?.wrong ?? '';
        if (typed) {
          if (!focused(answers)) answers.value = (quiz?.answers ?? []).join(', ');
          return;
        }
        const options = def.type === 'selection' ? def.options : [];
        while (marks.length > options.length) {
          marks.pop();
          names.pop();
          list.lastElementChild?.remove();
        }
        while (marks.length < options.length) {
          const index = marks.length;
          const mark = el('input', { type: 'checkbox', class: 'fd-check' }) as HTMLInputElement;
          mark.addEventListener('change', () => designer.setOptionDetails(id, index, { correct: mark.checked }));
          const name = el('span', { class: 'fd-kind-points-name' });
          list.append(el('li', { class: 'fd-kind-points-row' }, el('label', { class: 'fd-inline-setting' }, mark, name)));
          marks.push(mark);
          names.push(name);
        }
        options.forEach((option, i) => {
          names[i].textContent = option.label;
          marks[i].setAttribute('aria-label', w.rightAnswerFor(option.label));
          marks[i].checked = option.correct === true;
        });
      },
    };
  }

  const parts: Part[] = [];
  if (kind === 'slider') parts.push(slider());
  if (kind === 'image-choice') parts.push(pictures());
  if (kind === 'matrix') parts.push(matrix());
  if (kind === 'address') parts.push(address());
  if (kind === 'repeating') parts.push(repeating());
  if (kind && SHUFFLED.has(kind)) parts.push(shuffle());
  parts.push(...choiceSettings(el, designer, id, kind));
  if (kind && SCORED.has(kind)) parts.push(points());
  if (kind && SEATED.has(kind)) parts.push(places());
  if (kind && MARKED.has(kind)) parts.push(quizQuestion(false));
  if (kind && TYPED_ANSWER.has(kind)) parts.push(quizQuestion(true));
  const app = appKindSettings(el, designer, id, kind);
  if (app) parts.push(app);
  if (!parts.length) return null;
  return {
    elements: parts.map((p) => p.element),
    standsIn: parts.some((p) => p.standsIn),
    refresh: (page, node) => parts.forEach((p) => p.refresh(page, node)),
  };
}
