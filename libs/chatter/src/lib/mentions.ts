import type { ChatterContext } from './chatter';
import type { Person } from './source';

/** What is being typed after an @, up to the cursor; null when the cursor is not in one. */
export function mentionAt(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const match = /(?:^|\s)@([\p{L}\p{N}._-]*)$/u.exec(before);
  return match ? { start: caret - match[1].length - 1, query: match[1] } : null;
}

/**
 * @mentions in a composer's box: people suggested as a name is typed after an
 * @, picked with the arrows and Enter (or a click), and kept as long as their
 * "@Name" is still in the text. Without a source of people, nothing happens.
 */
export function mentions(context: ChatterContext, box: HTMLTextAreaElement) {
  const { el, labels, source } = context;
  const list = el('ul', { class: 'fd-mentions', role: 'listbox', hidden: '', 'aria-label': labels.search });
  let picked: Person[] = [];
  let found: Person[] = [];
  let active = 0;
  let asking = 0;

  const close = () => {
    list.hidden = true;
    found = [];
    box.removeAttribute('aria-activedescendant');
  };
  function draw() {
    list.replaceChildren(
      ...(found.length
        ? found.map((person, i) => {
            const option = el('li', { role: 'option', id: `fd-mention-${i}`, 'aria-selected': String(i === active), class: i === active ? 'fd-active' : '' }, person.name);
            option.addEventListener('mousedown', (event) => event.preventDefault()); // the box keeps the focus
            option.addEventListener('click', () => pick(person));
            return option;
          })
        : [el('li', { class: 'fd-empty' }, labels.noOneFound)])
    );
    list.hidden = false;
  }
  function pick(person: Person) {
    const at = mentionAt(box.value, box.selectionStart ?? box.value.length);
    if (!at) return close();
    const inserted = `@${person.name} `;
    box.value = box.value.slice(0, at.start) + inserted + box.value.slice(box.selectionStart ?? box.value.length);
    const caret = at.start + inserted.length;
    box.setSelectionRange(caret, caret);
    if (!picked.some((p) => p.id === person.id)) picked.push(person);
    close();
    box.focus();
  }

  box.addEventListener('input', async () => {
    const at = source.people ? mentionAt(box.value, box.selectionStart ?? box.value.length) : null;
    if (!at || !source.people) return close();
    const mine = ++asking;
    const people = await source.people(at.query);
    if (mine !== asking) return; // a newer question is on its way
    found = people.slice(0, 8);
    active = 0;
    draw();
  });
  box.addEventListener('keydown', (event) => {
    if (list.hidden || !found.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      active = (active + (event.key === 'ArrowDown' ? 1 : -1) + found.length) % found.length;
      draw();
      box.setAttribute('aria-activedescendant', `fd-mention-${active}`);
    } else if ((event.key === 'Enter' && !event.ctrlKey && !event.metaKey) || event.key === 'Tab') {
      event.preventDefault();
      event.stopImmediatePropagation();
      pick(found[active]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
    }
  });

  return {
    list,
    /** The people still mentioned in the text. */
    picked: () => picked.filter((person) => box.value.includes(`@${person.name}`)),
    reset() {
      picked = [];
      close();
    },
  };
}
