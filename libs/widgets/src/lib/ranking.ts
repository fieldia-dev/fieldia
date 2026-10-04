import type { Option } from '@fieldia/core';
import { announcer, describeState, fillIn, maker, wordsFor } from './kind-parts';
import { shownOptions } from './shuffle';
import type { WidgetFactory } from './widgets';

/**
 * Options put in order (`selection.ranking`, on a field of several answers):
 * each line numbered, dragged by the pointer — the lines it passes the middle
 * of make way — or moved a place at a time with its buttons or Alt+↑/↓, the
 * cursor staying with it. Each move is said politely to screen readers. The
 * answer is the options' values in order, kept once something has moved:
 * until then the question is not answered. An order set from outside shows
 * as it is, the options it leaves out after it. `options.shuffle` starts the
 * lines in an order of the form's own, so none is first for being written first.
 */

interface Item {
  option: Option;
  element: HTMLLIElement;
  place: HTMLElement;
  up: HTMLButtonElement;
  down: HTMLButtonElement;
}

/** How far the pointer goes before a press becomes a drag. */
const SLOP = 4;

export const rankingWidget: WidgetFactory = ({ form, name, field, node, id, document, labels, locale }) => {
  const words = wordsFor(labels, locale);
  const make = maker(document);
  const options: Option[] = shownOptions(field.type === 'selection' ? field.options : [], form, name, node);
  const list = make('ol', { class: 'fd-rank-list' });
  const voice = announcer(make);
  const element = make('div', { id, class: 'fd-ranking', role: 'group' }, list, voice.element);

  const items: Item[] = options.map((option) => {
    const label = option.label;
    const place = make('span', { class: 'fd-rank-place', 'aria-hidden': 'true' });
    const up = make('button', { type: 'button', class: 'fd-rank-move fd-rank-up', 'aria-label': fillIn(words.moveUp, { label }) }, '↑');
    const down = make('button', { type: 'button', class: 'fd-rank-move fd-rank-down', 'aria-label': fillIn(words.moveDown, { label }) }, '↓');
    const grip = make('span', { class: 'fd-rank-grip', 'aria-hidden': 'true' });
    const li = make('li', { class: 'fd-rank-item', 'data-value': String(option.value) }, grip, place, make('span', { class: 'fd-rank-words' }, label), make('span', { class: 'fd-rank-tools' }, up, down));
    const item: Item = { option, element: li, place, up, down };
    up.addEventListener('click', () => move(item, -1, 'up'));
    down.addEventListener('click', () => move(item, 1, 'down'));
    li.addEventListener('pointerdown', (event) => press(item, event));
    return item;
  });

  let readonly = false;
  /** The lines in the order shown now. */
  let shown: Item[] = [...items];
  /** The button to give the cursor back to once a move has been drawn. */
  let refocus: { item: Item; which: 'up' | 'down' } | null = null;

  function draw(next: Item[]) {
    shown = next;
    next.forEach((item, i) => {
      if (list.children[i] !== item.element) list.insertBefore(item.element, list.children[i] ?? null);
      item.place.textContent = String(i + 1);
      item.up.disabled = i === 0;
      item.down.disabled = i === next.length - 1;
    });
  }
  /** Keep the order as the answer, and say where the line went. */
  function keep(next: Item[], moved: Item) {
    voice.say(fillIn(words.movedTo, { label: moved.option.label, n: next.indexOf(moved) + 1, total: next.length }));
    form.setValue(name, next.map((item) => item.option.value));
  }
  function move(item: Item, step: number, which: 'up' | 'down') {
    const from = shown.indexOf(item);
    const to = from + step;
    if (readonly || to < 0 || to >= shown.length) return;
    const next = [...shown];
    next.splice(from, 1);
    next.splice(to, 0, item);
    const holding = item.element.contains(document.activeElement);
    // At an end, the button that moved it is no use: the cursor goes to the other.
    refocus = holding ? { item, which: (which === 'up' && to === 0) || (which === 'down' && to === next.length - 1) ? (which === 'up' ? 'down' : 'up') : which } : null;
    keep(next, item);
    giveBackFocus();
  }
  function giveBackFocus() {
    if (!refocus) return;
    const { item, which } = refocus;
    refocus = null;
    item[which].focus();
  }

  list.addEventListener('keydown', (event) => {
    if (readonly || !event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
    const item = items.find((i) => i.element.contains(event.target as Node));
    if (!item) return;
    event.preventDefault();
    move(item, event.key === 'ArrowUp' ? -1 : 1, event.key === 'ArrowUp' ? 'up' : 'down');
  });

  // Dragging: the line follows the pointer from place to place; the order is kept when it is let go.
  function press(item: Item, event: PointerEvent) {
    if (readonly || event.button !== 0 || (event.target as Element).closest('button')) return;
    // On a touch screen only the grip drags: anywhere else the page scrolls.
    if (event.pointerType === 'touch' && !(event.target as Element).closest('.fd-rank-grip')) return;
    const startY = event.clientY;
    const before = [...shown];
    let lifted = false;
    item.element.setPointerCapture?.(event.pointerId);
    const onMove = (e: PointerEvent) => {
      if (!lifted && Math.abs(e.clientY - startY) < SLOP) return;
      if (!lifted) {
        lifted = true;
        item.element.classList.add('fd-rank-lifted');
      }
      e.preventDefault();
      // Its place: after every other line whose middle the pointer has passed.
      const others = shown.filter((other) => other !== item);
      const at = others.filter((other) => {
        const box = other.element.getBoundingClientRect();
        return box.top + box.height / 2 < e.clientY;
      }).length;
      if (shown.indexOf(item) !== at) draw([...others.slice(0, at), item, ...others.slice(at)]);
    };
    const onEnd = () => {
      item.element.removeEventListener('pointermove', onMove);
      item.element.removeEventListener('pointerup', onEnd);
      item.element.removeEventListener('pointercancel', onEnd);
      item.element.classList.remove('fd-rank-lifted');
      if (shown.some((other, i) => other !== before[i])) keep(shown, item);
    };
    item.element.addEventListener('pointermove', onMove);
    item.element.addEventListener('pointerup', onEnd);
    item.element.addEventListener('pointercancel', onEnd);
  }

  /** The order a value says: its options first, in its order, then those it leaves out, as they were shown. */
  function orderOf(value: unknown): Item[] {
    if (!Array.isArray(value)) return shown;
    const named = value.map((v) => items.find((item) => item.option.value === v)).filter((item): item is Item => !!item);
    return [...new Set([...named, ...shown])];
  }

  draw(shown);
  return {
    element,
    focus: () => (shown[0]?.down.disabled ? shown[0]?.up : shown[0]?.down)?.focus(),
    update(state) {
      readonly = state.readonly;
      element.classList.toggle('fd-ranking-locked', readonly);
      const next = orderOf(state.value);
      if (next.some((item, i) => item !== shown[i]) || !list.children.length) draw(next);
      for (const item of items) item.up.hidden = item.down.hidden = readonly;
      giveBackFocus();
      describeState(element, state);
    },
  };
};
