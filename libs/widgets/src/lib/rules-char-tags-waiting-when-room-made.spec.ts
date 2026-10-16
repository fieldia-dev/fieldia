import { mountKind } from './test-kinds';

/**
 * Tags typed as words (`char.tags`) at their most (`options.max`): a tag typed past the most waits in the box, and the
 * form keeps it unread with why ("Materials takes at most 2. Not added: steel"), so a save is refused over it
 * (input rules §2: "unread: tags past the most wait for room"). Then a chip is taken away, making room. Writing the
 * field another way lets the unread text go (form.ts `unreadKept`), but the box keeps showing "steel" (its own
 * `waiting`): a save now goes through without the tag the person typed and still sees in the box, unsaid. The
 * waiting tag must be taken once there is room, or stay unread so the save is refused — never dropped in silence.
 */

describe('char.tags at its most: a tag waiting, then room made', () => {
  it('the tag waiting is never dropped by a save once a chip is taken away', () => {
    const { el, form, value } = mountKind({ type: 'char', label: 'Materials' }, { widget: 'tags', options: { max: 2 } });
    form.setValue('x', 'oak, glass');
    const input = el.querySelector('input') as HTMLInputElement;
    input.focus();
    input.value = 'steel';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.blur();
    expect(form.getState().unread['x']?.text).toBe('steel');
    expect(input.value).toBe('steel');
    // Room made: the chip "oak" taken away with its ×.
    const remove = [...el.querySelectorAll('.fd-chip')].find((chip) => chip.textContent?.includes('oak'))?.querySelector('.fd-chip-remove') as HTMLButtonElement;
    remove.click();
    expect(input.value).toBe('steel');
    // Either the waiting tag is taken now there is room, or a check still refuses it: never a pass without it.
    const passes = form.validate();
    const kept = String(value() ?? '').includes('steel');
    expect({ passes, kept, unread: form.getState().unread['x']?.text ?? null, box: input.value }).not.toEqual({ passes: true, kept: false, unread: null, box: 'steel' });
  });
});
