import { foldDigits, saveProblemOf, type DataSource, type FieldNode, type FormState } from '@fieldia/core';
import { afterPress, drawIcon } from '@fieldia/widgets';
import { setAttr, setHidden, setText } from './dom';
import type { JoinContext, PageJoin } from './joins';
import { installVerifyStyles } from './verify-styles';

/**
 * Proof that the person owns an email or a phone — the verify part (`options.verify` on a field, the data source's
 * `sendCode` and `checkCode`): under the field's box, once it holds an address or a number that reads, **Send a code**
 * (one button for each way the page offers: by WhatsApp, by SMS); then the code's box (`one-time-code`, so a phone
 * offers the code from its message), **Confirm**, how long the code works and when another may be asked for, each said
 * as it changes; right, the field is **Confirmed** (`form.joined('verify').mark`) while it holds that value, and its answers go
 * with the app's proof. Wrong: the tries left; too late, or none left: a new code. Fieldia sends nothing itself and
 * holds no keys: the app's source sends and checks. Without both members, nothing of this is drawn, and the form asks
 * for no code.
 */

/** What the verify part needs of the viewer that draws the page: its source can send and check codes. */
type VerifyContext = JoinContext & { dataSource: DataSource };

/** The ways a field's code may be sent, as its node offers them (`options.verify.by`): none named, the app's one way. */
export function verifyWays(node: FieldNode): { value: string; label?: string }[] {
  const asked = node.options?.['verify'];
  const by = asked && typeof asked === 'object' && !Array.isArray(asked) ? (asked as { by?: unknown }).by : undefined;
  if (!Array.isArray(by)) return [];
  return by.flatMap((one) => {
    if (typeof one === 'string') return [{ value: one }];
    const own = one as { value?: unknown; label?: unknown } | null;
    return own && typeof own.value === 'string' ? [{ value: own.value, ...(typeof own.label === 'string' ? { label: own.label } : {}) }] : [];
  });
}

/**
 * The verify part's side of a page (joins.ts): under each field whose node asks for a code, its box — where the source
 * can send and check codes; none drawn without them.
 */
export function draw(ctx: JoinContext): PageJoin | null {
  const source = ctx.dataSource;
  return source?.sendCode && source.checkCode ? watchVerify({ ...ctx, dataSource: source }) : null;
}

/** The field nodes of a layout, at any depth. */
const fieldNodes = (node: { type: string; children?: unknown }): FieldNode[] => [...(node.type === 'field' ? [node as FieldNode] : []), ...(Array.isArray(node.children) ? (node.children as { type: string }[]).flatMap(fieldNodes) : [])];

export function watchVerify(ctx: VerifyContext): PageJoin {
  installVerifyStyles(ctx.doc);
  const asking = fieldNodes(ctx.page.layout).filter((node) => node.options?.['verify'] !== undefined && node.options['verify'] !== false);
  /** Each field's box under it, by its node: placed once the page's questions are drawn. */
  const fields = new Map<string, { update(state: FormState): void; destroy(): void }>();
  return {
    update(state) {
      for (const node of asking) {
        const wrapper = fields.has(node.id) ? null : ctx.content()?.querySelector<HTMLElement>(`[data-node="${node.id}"]`);
        if (wrapper) fields.set(node.id, fieldVerify(ctx, node, wrapper));
      }
      for (const one of fields.values()) one.update(state);
    },
    destroy() {
      for (const one of fields.values()) one.destroy();
      fields.clear();
    },
  };
}

/** A code sent for a value: its id, how many digits, when it stops working, how it went. */
interface Sent {
  value: string;
  id?: string;
  by?: string;
  length: number;
  expiresAt: number | null;
  /** Too late, or no tries left: a new one is asked for. */
  spent?: boolean;
}

function fieldVerify(ctx: VerifyContext, node: FieldNode, wrapper: HTMLElement): { update(state: FormState): void; destroy(): void } {
  const { form, el, labels, fill, doc } = ctx;
  const name = node.field;
  const kind: 'email' | 'phone' = node.widget === 'email' ? 'email' : 'phone';
  const win = doc.defaultView;
  const id = `${wrapper.querySelector('.fd-label')?.getAttribute('for') ?? name}-verify`;
  const wayWords = (way: { value: string; label?: string }) => way.label ?? ({ sms: labels.verifyBySms, whatsapp: labels.verifyByWhatsapp, call: labels.verifyByCall, email: labels.verifyByEmail } as Record<string, string>)[way.value] ?? way.value;
  const ways = verifyWays(node);
  const sends = (ways.length ? ways : [null]).map((way) => {
    const button = el('button', { type: 'button', class: 'fd-button fd-verify-send', 'data-by': way?.value }, way && ways.length > 1 ? fill(labels.verifySendBy, { by: wayWords(way) }) : labels.verifySend);
    button.addEventListener('click', () => void send(way?.value));
    return button;
  });
  const sendRow = el('div', { class: 'fd-verify-row' }, ...sends);
  const code = el('input', { id: `${id}-code`, class: 'fd-input fd-verify-code', type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code', spellcheck: 'false', 'aria-describedby': `${id}-said` }) as HTMLInputElement;
  const confirm = el('button', { type: 'button', class: 'fd-button fd-button-primary fd-verify-confirm' }, labels.verifyCheck);
  const again = el('button', { type: 'button', class: 'fd-button fd-button-link fd-verify-again', hidden: '' }, labels.verifyAgain);
  const wait = el('span', { class: 'fd-verify-wait', hidden: '' });
  const codeRow = el('div', { class: 'fd-verify-row fd-verify-code-row', hidden: '' }, code, confirm, again, wait);
  const said = el('p', { class: 'fd-verify-said', id: `${id}-said`, role: 'status', 'aria-live': 'polite' });
  const mark = drawIcon(doc, 'check', ctx.icons);
  const done = el('p', { class: 'fd-verify-done', hidden: '' }, ...(mark ? [mark] : []), labels.verifyDone);
  const box = el('div', { class: 'fd-verify', 'data-verify': name, hidden: '' }, sendRow, codeRow, said, done);
  wrapper.append(box);

  let sent: Sent | null = null;
  let againAt = 0;
  let busy: 'sending' | 'checking' | null = null;
  let tone: 'error' | null = null;
  let gone = false;
  let ticking: number | undefined;
  const request = () => {
    const state = form.getState();
    return { pageId: ctx.page.id, model: ctx.page.data.kind === 'record' ? ctx.page.data.model : '', recordId: state.recordId ?? null, field: name };
  };
  const say = (words: string, error = false) => {
    tone = error ? 'error' : null;
    setText(said, words);
    said.classList.toggle('fd-verify-error', error);
  };
  /** How long a code works, in words: whole minutes, rounded up. */
  const worksFor = (at: number | null) => {
    if (at === null) return '';
    const minutes = Math.max(1, Math.ceil((at - Date.now()) / 60000));
    return minutes === 1 ? labels.verifyWorksForOne : fill(labels.verifyWorksFor, { minutes });
  };
  const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  /** Once a second while a code is out: Send again when its wait is over, and a code too late said so. */
  const tick = () => {
    if (!sent || gone) return stopTicking();
    const left = Math.ceil((againAt - Date.now()) / 1000);
    setHidden(wait, left <= 0);
    if (left > 0) setText(wait, fill(labels.verifyAgainIn, { time: clock(left) }));
    setHidden(again, left > 0);
    if (!sent.spent && sent.expiresAt !== null && Date.now() > sent.expiresAt) {
      sent.spent = true;
      say(labels.verifyExpired, true);
      render(form.getState());
    }
    if (sent.spent && left <= 0) stopTicking();
  };
  const stopTicking = () => {
    if (ticking !== undefined) win?.clearInterval(ticking);
    ticking = undefined;
  };

  async function send(by?: string) {
    if (busy) return;
    const value = String(form.getState().values[name] ?? '');
    busy = 'sending';
    setAttr(box, 'aria-busy', 'true');
    say(labels.verifySending);
    try {
      const answer = await (ctx.dataSource.sendCode as NonNullable<DataSource['sendCode']>)({ ...request(), value, kind, ...(by ? { by } : {}), language: ctx.tag });
      // Gone, or the value changed while it was sent: this code is no longer the field's.
      if (gone || form.getState().values[name] !== value) return;
      const expiresAt = answer.expiresAt ? Date.parse(answer.expiresAt) : NaN;
      sent = { value, ...(answer.id ? { id: answer.id } : {}), ...(by ? { by } : {}), length: answer.length ?? 6, expiresAt: Number.isNaN(expiresAt) ? null : expiresAt };
      againAt = Date.now() + (answer.retryAfter ?? 30) * 1000;
      const way = by ? ways.find((one) => one.value === by) : undefined;
      // The number or the address as its box shows it — "+20 10 1234 5678" — rather than as it is kept.
      const box = wrapper.querySelector<HTMLInputElement>('input[type="tel"], input[type="email"]');
      const shown = box?.value.trim() || value;
      say([answer.message ?? fill(way ? labels.verifySentBy : labels.verifySent, { value: shown, by: way ? wayWords(way) : '' }), worksFor(sent.expiresAt)].filter(Boolean).join(' '));
      code.value = '';
      code.maxLength = sent.length;
      setAttr(code, 'aria-label', fill(labels.verifyCodeName, { value: shown }));
      stopTicking();
      ticking = win?.setInterval(tick, 1000);
      tick();
      render(form.getState());
      code.focus();
    } catch (error) {
      if (gone) return;
      const problem = saveProblemOf(error);
      say(problem.kind === 'rule' ? problem.message : labels.verifyNotSent, true);
    } finally {
      busy = null;
      box.removeAttribute('aria-busy');
      if (!gone) render(form.getState());
    }
  }

  async function check() {
    const out = sent;
    if (busy || !out || out.spent) return;
    const typed = foldDigits(code.value).replace(/[\s-]/g, '');
    if (!typed) return say(labels.verifyTypeCode, true);
    busy = 'checking';
    setAttr(box, 'aria-busy', 'true');
    say(labels.verifyChecking);
    try {
      const answer = await (ctx.dataSource.checkCode as NonNullable<DataSource['checkCode']>)({ ...request(), value: out.value, code: typed, ...(out.id ? { id: out.id } : {}) });
      if (gone || form.getState().values[name] !== out.value) return;
      if (answer.ok) {
        sent = null;
        stopTicking();
        say('');
        form.joined('verify')?.mark(name, { value: out.value, ...(answer.proof !== undefined ? { proof: answer.proof } : {}) });
        ctx.announce(labels.verifyDone);
        return;
      }
      const spent = answer.expired === true || answer.triesLeft === 0;
      if (spent) out.spent = true;
      const why = answer.expired ? labels.verifyExpired : answer.triesLeft === 0 ? labels.verifyWrongNone : answer.triesLeft === undefined ? labels.verifyWrong : answer.triesLeft === 1 ? labels.verifyWrongOne : fill(labels.verifyWrongSome, { tries: answer.triesLeft });
      say(answer.message ?? why, true);
      if (!spent) code.select();
    } catch {
      if (!gone) say(labels.verifyNotChecked, true);
    } finally {
      busy = null;
      box.removeAttribute('aria-busy');
      if (!gone) render(form.getState());
    }
  }

  confirm.addEventListener('click', () => void check());
  again.addEventListener('click', () => void send(sent?.by));
  code.addEventListener('keydown', (event) => {
    // Enter confirms the code: it never sends the form.
    if (event.key !== 'Enter' || event.isComposing) return;
    event.preventDefault();
    event.stopPropagation();
    void check();
  });
  code.addEventListener('input', () => {
    // A code typed or pasted whole, its digits however written: checked at once.
    const typed = foldDigits(code.value).replace(/[\s-]/g, '');
    if (sent && !sent.spent && typed.length === sent.length && /^\d+$/.test(typed)) void check();
  });

  /** Whether its box shows, as the state stands: once the field holds an address or a number that reads, on a form that may be changed. */
  function ready(state: FormState) {
    const value = state.values[name];
    return typeof value === 'string' && !!value.trim() && !state.unread[name] && form.problem(name) === null && ctx.editable() && !!form.joined('verify')?.asks(name);
  }
  /** Its rows as the state stands. */
  function rows(state: FormState) {
    const value = state.values[name];
    const proved = typeof value === 'string' && !!value.trim() && state.verified?.[name]?.value === value;
    const asked = ready(state);
    setHidden(box, !proved && !asked && !sent);
    setHidden(done, !proved);
    setHidden(sendRow, proved || !asked || (!!sent && !sent.spent));
    setHidden(codeRow, proved || !sent || sent.spent === true);
  }

  function render(state: FormState) {
    const value = state.values[name];
    const text = typeof value === 'string' ? value.trim() : '';
    const proved = !!text && state.verified?.[name]?.value === value;
    // A value changed since its code was sent: that code is no longer the field's.
    if (sent && sent.value !== value) {
      sent = null;
      stopTicking();
      say('');
    }
    // Its box comes and goes once a press going on has ended: left by a press elsewhere (Book a viewing), a box shown as
    // the pointer comes down would move what is below from under it, and the press would be lost (press.ts). Its rows
    // change at once inside it, as its own buttons are pressed.
    if (box.hidden === (proved || ready(state) || !!sent)) afterPress(doc, box, () => !gone && rows(form.getState()));
    else rows(state);
    if (proved && tone === null) setText(said, '');
    for (const button of [...sends, confirm, again]) setAttr(button, 'aria-busy', busy && (button === confirm ? busy === 'checking' : busy === 'sending') ? 'true' : null);
  }

  return {
    update: render,
    destroy() {
      gone = true;
      stopTicking();
      box.remove();
    },
  };
}
