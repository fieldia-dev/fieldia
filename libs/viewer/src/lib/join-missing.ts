import type { FieldNode, FormState, Messages, Part } from '@fieldia/core';
import type { JoinContext, JoinDrawing, PageJoin } from './joins';

/** The parts that join a form and guard its send whose drawing a person meets: what each stands for, as a send names it. */
const GUARDED: Record<string, { words: 'guardVerify' | 'guardPay'; guards(ctx: JoinContext): boolean }> = {
  // As the form's own gates say (@fieldia/core's joins.ts): a code where the source sends and checks one, a payment where it takes one.
  verify: { words: 'guardVerify', guards: (ctx) => !!(ctx.dataSource?.sendCode && ctx.dataSource.checkCode) },
  pay: { words: 'guardPay', guards: (ctx) => !!ctx.dataSource?.pay },
};

/** The field nodes of a layout, at any depth. */
const fieldNodes = (node: { type: string; children?: unknown }): FieldNode[] => [...(node.type === 'field' ? [node as FieldNode] : []), ...(Array.isArray(node.children) ? (node.children as { type: string }[]).flatMap(fieldNodes) : [])];

/**
 * A part that joins the form and guards its send — the code check, the payment step — whose drawing could not come
 * (0.35.1: the walk's mobile said nothing of it until Submit): a code's box said at once under each field that asks
 * for one, in the words a send would say, with Retry where its parts can be asked for anew (else the words ask for a
 * reload, the typing kept for it); a payment step said by the send it stops, as before. Drawn in its place once its
 * parts come, by that Retry or a send's (`retry`). Null where the part guards nothing on this page.
 */
export function missingJoin(part: Part, drawing: Part<JoinDrawing>, ctx: JoinContext, messages: Messages, retryLabel: string): (PageJoin & { retry(): Promise<boolean> }) | null {
  const guarded = GUARDED[part.name];
  if (!guarded?.guards(ctx)) return null;
  const { el, form, page } = ctx;
  /** Asked for anew where the browser can: those of its parts that have not come, each able to be asked again. */
  const again = () => [part, drawing].every((one) => one.loaded !== undefined || one.asksAgain === true);
  const words = () => ctx.fill(page.data.kind === 'responses' ? messages.guardNotSent : messages.guardNotSaved, { part: messages[guarded.words], again: again() ? messages.guardTryAgain : messages.guardReload });
  const notes: HTMLElement[] = [];
  const note = () => {
    const button = el('button', { type: 'button', class: 'fd-button fd-button-link fd-retry' }, retryLabel);
    const made = el('div', { class: 'fd-error fd-join-missing', role: 'status' }, el('span', {}, words()), button);
    button.hidden = !again();
    button.addEventListener('click', () => void retry());
    notes.push(made);
    return made;
  };
  /** Its notes' words as they stand: Retry where it can work. */
  const said = () => {
    for (const one of notes) {
      (one.firstElementChild as HTMLElement).textContent = words();
      (one.lastElementChild as HTMLElement).hidden = !again();
    }
  };
  // The payment step's place, under the questions — said by the send it stops, under its buttons, as it was; a code's
  // box's, under each field asking for one, said there at once (placed as the field is drawn).
  const place = part.name === 'pay' ? el('div', { class: 'fd-join-place', hidden: '' }) : null;
  const after = place ? [place] : [];
  const asking = part.name === 'verify' ? fieldNodes(page.layout).filter((node) => node.options?.['verify'] !== undefined && node.options['verify'] !== false) : [];
  const placed = new Set<string>();
  /** Drawn once its parts came: what it draws stands in its notes' place from then. */
  let drawn: PageJoin | null = null;
  let asked: Promise<boolean> | null = null;
  async function retry(): Promise<boolean> {
    if (drawn) return true;
    asked ??= Promise.all([part.loaded ?? part.load(), drawing.load()]).then(
      ([, made]) => {
        drawn = made.draw(ctx) ?? {};
        for (const one of notes.splice(0)) one.remove();
        if (place?.isConnected && drawn.after?.length) place.replaceWith(...drawn.after);
        else place?.remove();
        drawn.update?.(form.getState());
        return true;
      },
      () => {
        asked = null;
        said();
        ctx.announce(words());
        return false;
      }
    );
    return asked;
  }
  return {
    after,
    retry,
    update(state: FormState) {
      if (drawn) return drawn.update?.(state);
      for (const node of asking) {
        const wrapper = placed.has(node.id) ? null : ctx.content()?.querySelector<HTMLElement>(`[data-node="${node.id}"]`);
        if (!wrapper) continue;
        placed.add(node.id);
        wrapper.append(note());
      }
    },
    destroy() {
      drawn?.destroy?.();
      for (const one of notes) one.remove();
      place?.remove();
    },
  };
}
