import type { ChatterContext } from './chatter';
import type { ChatterId, Reaction } from './source';

/** The reactions offered at a click: the ones teams use most. */
export const REACTION_CHOICES = ['👍', '❤️', '😄', '🎉', '👀', '✅'];

/**
 * A message's reactions: a chip for each, pressed when the person's own is
 * among them and toggled by a click, and a button that offers the others.
 * Nothing is shown when the source cannot keep reactions.
 */
export function reactionBar(context: ChatterContext, messageId: ChatterId, reactions: readonly Reaction[]): HTMLElement | null {
  const { el, labels, source } = context;
  if (!source.react) return null;
  const react = source.react.bind(source);
  const bar = el('div', { class: 'fd-reactions' });
  const picker = el('div', { class: 'fd-reaction-picker', hidden: '', role: 'group', 'aria-label': labels.react });

  const toggle = async (emoji: string) => {
    const record = context.record();
    if (!record) return;
    picker.hidden = true;
    draw(await react(record, messageId, emoji));
  };
  for (const emoji of REACTION_CHOICES) {
    const choice = el('button', { type: 'button', 'data-emoji': emoji, 'aria-label': emoji }, emoji);
    choice.addEventListener('click', () => void toggle(emoji));
    picker.append(choice);
  }
  const add = el('button', { type: 'button', class: 'fd-reaction-add', 'aria-label': labels.react, 'aria-expanded': 'false' }, '☺');
  add.addEventListener('click', () => {
    picker.hidden = !picker.hidden;
    add.setAttribute('aria-expanded', String(!picker.hidden));
  });
  picker.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      picker.hidden = true;
      add.focus();
    }
  });

  function draw(list: readonly Reaction[]) {
    const chips = list.map((reaction) => {
      const chip = el('button', { type: 'button', class: 'fd-reaction', 'aria-pressed': String(reaction.mine) }, `${reaction.emoji} ${reaction.count}`);
      chip.addEventListener('click', () => void toggle(reaction.emoji));
      return chip;
    });
    bar.replaceChildren(...chips, add, picker);
  }
  draw(reactions);
  return bar;
}
