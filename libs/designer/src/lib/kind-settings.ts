import type { Field, FieldNode, Page } from '@fieldia/core';
import { appKindSettings } from './app-kinds-ui';
import { iconButton, type ElementFactory } from './chrome';
import { columnsEditor } from './columns-editor';
import type { Designer } from './designer';
import { ADDRESS_PARTS } from './kind-commands';

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
const PART_WORDS: Record<(typeof ADDRESS_PARTS)[number], string> = { street: 'Street', city: 'City', postcode: 'Postcode', country: 'Country' };

const optionsOf = (field: Field) => (field.type === 'selection' ? field.options : field.type === 'matrix' ? field.columns : []);
const numberOrNull = (text: string) => (text.trim() === '' || !Number.isFinite(Number(text)) ? null : Number(text));

export function kindSettings(el: ElementFactory, designer: Designer, id: string, kind: string | null): KindSettings | null {
  const focused = (node: Element) => node.ownerDocument.activeElement === node;
  const word = (text: string, control: HTMLElement) => el('label', { class: 'fd-inline-setting' }, el('span', {}, text), control);
  const numberBox = (label: string, extra: Record<string, string> = {}) =>
    el('input', { type: 'number', class: 'fd-inline-input fd-inline-number', 'aria-label': label, inputmode: 'decimal', ...extra }) as HTMLInputElement;
  const textBox = (label: string, placeholder: string) => el('input', { class: 'fd-inline-input fd-inline-words', 'aria-label': label, placeholder, autocomplete: 'off' }) as HTMLInputElement;
  const toggle = (label: string, onClick: (on: boolean) => void) => {
    const button = el('button', { type: 'button', class: 'fd-switch', role: 'switch', 'aria-checked': 'false', 'aria-label': label }) as HTMLButtonElement;
    button.addEventListener('click', () => onClick(button.getAttribute('aria-checked') !== 'true'));
    return { button, element: el('span', { class: 'fd-inline-setting fd-inline-toggle' }, button, el('span', { 'aria-hidden': 'true' }, label)) };
  };
  /** A setting of the question's widget, from its node's options. */
  const optionOf = (node: FieldNode, key: string) => node.options?.[key];

  function slider(): Part {
    const from = numberBox('From', { step: '1' });
    const to = numberBox('To', { step: '1' });
    const step = numberBox('Step', { min: '0', step: 'any' });
    // Saved once a number is typed and left, so a range half typed is not refused.
    const range = () => {
      const min = numberOrNull(from.value);
      const max = numberOrNull(to.value);
      if (min !== null && max !== null) designer.setRange(id, { min, max });
    };
    from.addEventListener('change', range);
    to.addEventListener('change', range);
    step.addEventListener('change', () => {
      const n = numberOrNull(step.value);
      designer.setWidgetOptions(id, { step: n !== null && n > 0 && n !== 1 ? n : null });
    });
    return {
      element: el('div', { class: 'fd-inline-row' }, word('From', from), word('to', to), word('Step', step)),
      standsIn: false,
      refresh(page, node) {
        const def = page.fields[node.field];
        if (!focused(from)) from.value = String('min' in def && def.min !== undefined ? def.min : 0);
        if (!focused(to)) to.value = String('max' in def && def.max !== undefined ? def.max : 100);
        const n = optionOf(node, 'step');
        if (!focused(step)) step.value = String(typeof n === 'number' ? n : 1);
      },
    };
  }

  function pictures(): Part {
    const list = el('ul', { class: 'fd-kind-pictures' });
    const several = toggle('Several answers', (on) => designer.setSeveral(id, on));
    const element = el('div', { class: 'fd-kind-block' }, el('span', { class: 'fd-prop-name' }, 'Pictures'), list, several.element);
    const rows: { thumb: HTMLElement; name: HTMLElement; address: HTMLInputElement; file: HTMLInputElement }[] = [];
    function row(index: number) {
      const thumb = el('span', { class: 'fd-kind-thumb' });
      const name = el('span', { class: 'fd-kind-picture-name' });
      const address = el('input', { class: 'fd-inline-input fd-kind-picture-address', placeholder: 'Picture address, https://…', autocomplete: 'off', spellcheck: 'false' }) as HTMLInputElement;
      // Kept once typed and left: a picture half typed is an address that is not there.
      address.addEventListener('change', () => designer.setOptionDetails(id, index, { image: address.value }));
      // Or a picture from this computer, kept in the page as a data: address.
      const file = el('input', { type: 'file', accept: 'image/*', class: 'fd-sr-only', tabindex: '-1' }) as HTMLInputElement;
      file.addEventListener('change', () => {
        const chosen = file.files?.[0];
        if (!chosen) return;
        const reader = new FileReader();
        reader.onload = () => designer.setOptionDetails(id, index, { image: String(reader.result ?? '') });
        reader.readAsDataURL(chosen);
        file.value = '';
      });
      const upload = el('button', { type: 'button', class: 'fd-button fd-button-link fd-kind-upload' }, 'Upload');
      upload.addEventListener('click', () => file.click());
      list.append(el('li', { class: 'fd-kind-picture' }, thumb, name, address, upload, file));
      rows.push({ thumb, name, address, file });
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
          const { thumb, name, address } = rows[i];
          name.textContent = option.label;
          address.setAttribute('aria-label', `Picture for ${option.label}`);
          const src = option.image ?? '';
          const shown = thumb.querySelector('img');
          if ((shown?.getAttribute('src') ?? '') !== src) thumb.replaceChildren(...(src ? [el('img', { src, alt: '' })] : []));
          // A picture uploaded is a long data: address: the box says so instead of showing it.
          if (!focused(address)) {
            const uploaded = src.startsWith('data:');
            address.value = uploaded ? '' : src;
            address.placeholder = uploaded ? 'Uploaded picture' : 'Picture address, https://…';
          }
        });
        several.button.setAttribute('aria-checked', String(def.type === 'selection' && def.multiple === true));
      },
    };
  }

  function matrix(): Part {
    const editors = (['rows', 'columns'] as const).map((which) => {
      const one = which === 'rows' ? 'Row' : 'Column';
      const list = el('ul', { class: 'fd-kind-items' });
      const read = () => [...list.querySelectorAll('input')].map((input) => input.value);
      const save = () => designer.setMatrixItems(id, which, read());
      const add = el('button', { type: 'button', class: 'fd-button fd-button-link', [`data-add-${which}`]: '' }, `Add ${one.toLowerCase()}`);
      const focusAt = (index: number) => {
        const input = list.querySelectorAll('input')[index] as HTMLInputElement | undefined;
        input?.focus();
        input?.select();
      };
      add.addEventListener('click', () => {
        const labels = read();
        if (designer.setMatrixItems(id, which, [...labels, `${one} ${labels.length + 1}`])) focusAt(labels.length);
      });
      const element = el('div', { class: 'fd-kind-block' }, el('span', { class: 'fd-prop-name' }, which === 'rows' ? 'Rows' : 'Columns'), list, add);
      return {
        element,
        update(items: { label: string }[]) {
          while (list.children.length > items.length) list.lastElementChild?.remove();
          while (list.children.length < items.length) {
            const index = list.children.length;
            const input = el('input', { class: 'fd-inline-input fd-kind-item', 'aria-label': `${one} ${index + 1}`, autocomplete: 'off' }) as HTMLInputElement;
            // Emptied while typed in, it stays until the cursor leaves; then it goes.
            input.addEventListener('input', () => input.value.trim() && save());
            input.addEventListener('change', () => !input.value.trim() && save());
            input.addEventListener('keydown', (event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              const labels = read();
              labels.splice(index + 1, 0, `${one} ${labels.length + 1}`);
              if (designer.setMatrixItems(id, which, labels)) focusAt(index + 1);
            });
            const remove = iconButton(el, `Remove ${one.toLowerCase()}`, '×', () => {
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
            remove.setAttribute('aria-label', `Remove ${one.toLowerCase()} ${item.label}`);
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
    let current: string[] = [...ADDRESS_PARTS];
    const chips = ADDRESS_PARTS.map((part) => {
      const chip = el('button', { type: 'button', class: 'fd-inline-chip', 'aria-pressed': 'true', 'data-part': part }, PART_WORDS[part]) as HTMLButtonElement;
      chip.addEventListener('click', () => designer.setAddressParts(id, current.includes(part) ? current.filter((p) => p !== part) : [...current, part]));
      return { part, chip };
    });
    return {
      element: el('div', { class: 'fd-inline-row' }, el('span', {}, 'Asks for'), el('div', { class: 'fd-inline-chips', role: 'group', 'aria-label': 'Parts of the address' }, ...chips.map((c) => c.chip))),
      standsIn: false,
      refresh(_page, node) {
        const parts = optionOf(node, 'parts');
        current = Array.isArray(parts) ? parts.filter((p): p is string => typeof p === 'string') : [...ADDRESS_PARTS];
        for (const { part, chip } of chips) chip.setAttribute('aria-pressed', String(current.includes(part)));
      },
    };
  }

  function repeating(): Part {
    const columns = columnsEditor(el, designer, id);
    // The table's column editor, for the fields of each card.
    const heading = columns.element.querySelector('.fd-prop-name');
    if (heading) heading.textContent = 'Fields in each card';
    const addField = columns.element.querySelector('[data-add-column]');
    if (addField) addField.textContent = 'Add field';
    const least = numberBox('At least', { min: '0', step: '1' });
    const most = numberBox('At most', { min: '1', step: '1' });
    const title = textBox('Card title', 'Entry');
    const button = textBox('Button words', 'Add another');
    const count = (input: HTMLInputElement, key: 'min' | 'max') =>
      input.addEventListener('change', () => {
        const n = numberOrNull(input.value);
        designer.setWidgetOptions(id, { [key]: n !== null && Number.isInteger(n) && n > 0 ? n : null });
      });
    count(least, 'min');
    count(most, 'max');
    title.addEventListener('input', () => designer.setWidgetOptions(id, { itemLabel: title.value }));
    button.addEventListener('input', () => designer.setWidgetOptions(id, { addLabel: button.value }));
    return {
      element: el(
        'div',
        { class: 'fd-kind-block' },
        columns.element,
        el('div', { class: 'fd-inline-row' }, word('At least', least), word('At most', most)),
        el('div', { class: 'fd-inline-row' }, word('Card title', title), word('Button words', button))
      ),
      standsIn: true,
      refresh(page, node) {
        columns.update(page.fields[node.field]);
        const text = (input: HTMLInputElement, value: unknown) => !focused(input) && (input.value = value === undefined || value === null ? '' : String(value));
        text(least, optionOf(node, 'min'));
        text(most, optionOf(node, 'max'));
        text(title, optionOf(node, 'itemLabel'));
        text(button, optionOf(node, 'addLabel'));
      },
    };
  }

  function shuffle(): Part {
    const toggled = toggle('Shuffle option order', (on) => designer.setWidgetOptions(id, { shuffle: on ? true : null }));
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
    const start = el('button', { type: 'button', class: 'fd-button fd-button-link fd-kind-give-points' }, 'Give points: make it a quiz');
    start.addEventListener('click', () => {
      if (designer.setOptionDetails(id, 0, { score: 0 })) (list.querySelector('input') as HTMLInputElement | null)?.focus();
    });
    const list = el('ul', { class: 'fd-kind-points' });
    const block = el('div', { class: 'fd-kind-block' }, el('span', { class: 'fd-prop-name' }, 'Points'), list);
    const rows: { name: HTMLElement; input: HTMLInputElement }[] = [];
    return {
      element: el('div', { class: 'fd-kind-points-box' }, start, block),
      standsIn: false,
      refresh(page, node) {
        const quiz = Object.values(page.fields).some((f) => optionsOf(f).some((o) => o.score !== undefined));
        start.hidden = quiz;
        block.hidden = !quiz;
        const options = optionsOf(page.fields[node.field]);
        while (rows.length > options.length) {
          rows.pop();
          list.lastElementChild?.remove();
        }
        while (rows.length < options.length) {
          const index = rows.length;
          const name = el('span', { class: 'fd-kind-points-name' });
          const input = numberBox('Points', { step: 'any', placeholder: '0' });
          input.addEventListener('input', () => designer.setOptionDetails(id, index, { score: numberOrNull(input.value) }));
          list.append(el('li', { class: 'fd-kind-points-row' }, name, input));
          rows.push({ name, input });
        }
        options.forEach((option, i) => {
          rows[i].name.textContent = option.label;
          rows[i].input.setAttribute('aria-label', `Points for ${option.label}`);
          if (!focused(rows[i].input)) rows[i].input.value = option.score === undefined ? '' : String(option.score);
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
  if (kind && SCORED.has(kind)) parts.push(points());
  const app = appKindSettings(el, designer, id, kind);
  if (app) parts.push(app);
  if (!parts.length) return null;
  return {
    elements: parts.map((p) => p.element),
    standsIn: parts.some((p) => p.standsIn),
    refresh: (page, node) => parts.forEach((p) => p.refresh(page, node)),
  };
}
