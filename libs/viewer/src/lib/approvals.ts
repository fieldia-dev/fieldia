import { fill, formApprovalsPart, labelAt, recordSentence, type ApprovalDecision, type ApprovalEntry, type ApprovalLevel, type Form, type FormApproval, type FormState, type Messages, type Page } from '@fieldia/core';
import { keepTabIn } from '@fieldia/widgets';
import { setAttr, setHidden, setText, type El } from './dom';
import type { ViewerLabels } from './labels';
import { installApprovalStyles } from './approvals-styles';

/**
 * A record's approvals — the approvals part (`approval` on a record's page) — drawn over the record, under its alerts:
 *
 * - **Where it stands**, said once in a line: "Waiting for Finance: Mona Adel or Hany Lotfy" — those still to decide at
 *   each level waiting, joined with "or" where any one of them is enough and "and" where all must — "Needs approval
 *   from Finance, then CFO" before it is sent, "Approved", or "Rejected by Mona Adel (Finance)" with why, quoted. The
 *   source's own words of why it needs approval under it.
 * - **Its levels in their order**, each with its state and who decided there: "Finance — Approved by Mona Adel".
 * - **Approve and Reject**, for each level this person may decide now (`approval.mine`): hidden for everyone else, and
 *   where the source takes no decisions. Reject asks why, in a dialog of its own; a refusal is said there, or beside
 *   the buttons, and nothing is decided.
 * - **What stays open** while it waits: "While it waits, only Notes can be changed." — every other field's lock saying
 *   why (the form's `approvalLock`).
 * - **Its history**, folded under a button that counts it: who asked, who decided, when, and why.
 *
 * Nothing shows while the record is new, has no levels, or before its source told them; a source that could not tell
 * them is said to have failed, with Try again.
 */

/** What the approvals part needs of the viewer that draws the page. */
export interface ApprovalsContext {
  form: Form;
  /** The page as shown: its words in the page's language. */
  page: Page;
  el: El;
  labels: ViewerLabels;
  /** The page's language, as its words name it: lists of names joined in it, its record named in it. */
  locale: string;
  /** The form's messages, in the page's language: a moment of the history written as its date boxes write a day. */
  messages: Messages;
  /** Words said at once to a screen reader. */
  announce(text: string): void;
  /** The form's own element: Reject's question is asked over it. */
  root: HTMLElement;
}

/** The band over the record, and how it follows the form. */
export interface ApprovalsKit {
  element: HTMLElement;
  update(state: FormState): void;
}

/** Each band's own ids, unique on the page. */
let bands = 0;

export function drawApprovals(ctx: ApprovalsContext): ApprovalsKit {
  const { form, page, el, labels, locale } = ctx;
  installApprovalStyles(ctx.root.ownerDocument);
  const prefix = `fd-approval-${++bands}`;
  const titleId = `${prefix}-title`;
  const title = el('p', { class: 'fd-approval-title', id: titleId });
  const why = el('p', { class: 'fd-approval-why', hidden: '' });
  const reason = el('p', { class: 'fd-approval-reason', hidden: '' });
  const words = el('div', { class: 'fd-approval-words' }, title, why, reason);
  const buttons = el('div', { class: 'fd-approval-actions' });
  const retry = el('button', { type: 'button', class: 'fd-button', hidden: '' }, labels.retry);
  retry.addEventListener('click', () => void form.refreshApprovals());
  const head = el('div', { class: 'fd-approval-head' }, el('span', { class: 'fd-approval-mark', 'aria-hidden': 'true' }), words, buttons, retry);
  const levels = el('ol', { class: 'fd-approval-levels' });
  const open = el('p', { class: 'fd-approval-open', hidden: '' });
  const said = el('p', { class: 'fd-approval-said', role: 'alert' });
  const historyId = `${prefix}-history`;
  const toggle = el('button', { type: 'button', class: 'fd-approval-toggle', 'aria-expanded': 'false', 'aria-controls': historyId });
  const history = el('ol', { class: 'fd-approval-history', id: historyId, hidden: '' });
  toggle.addEventListener('click', () => {
    const shown = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(shown));
    history.hidden = !shown;
  });
  const element = el('section', { class: 'fd-approval', 'aria-labelledby': titleId, hidden: '' }, head, levels, open, said, toggle, history);

  /** Names joined as the page's language joins them: "Mona Adel or Hany Lotfy" where any one is enough, "… and …" where all must. */
  const joined = (names: readonly string[], type: 'conjunction' | 'disjunction' = 'conjunction') => (names.length < 2 ? (names[0] ?? '') : new Intl.ListFormat(locale, { type }).format(names));
  /** A level's name by its id, as told — else as the history kept it, else its id. */
  const levelName = (approval: FormApproval, id: string | undefined, entry?: ApprovalEntry) => approval.levels.find((level) => level.id === id)?.name ?? entry?.levelName ?? id ?? '';
  /** Who has yet to decide at a level: its approvers who have not, by name. */
  const toDecide = (level: ApprovalLevel) => level.approvers.filter((one) => !one.decision).map((one) => one.name);
  const decidedBy = (level: ApprovalLevel, decision: ApprovalDecision) => level.approvers.filter((one) => one.decision === decision).map((one) => one.name);
  const sentence = (noun: string | undefined, plain: string) => recordSentence(page.records, noun, plain, locale);

  /** Where it stands, in a line. */
  function headline(approval: FormApproval): string {
    const asked = approval.levels.filter((level) => level.state !== 'skipped');
    switch (approval.status) {
      case 'waiting': {
        const who = asked.filter((level) => level.state === 'waiting').map((level) => {
          const names = toDecide(level);
          return names.length ? fill(labels.approvalWho, { level: level.name, names: joined(names, level.needs === 'all' ? 'conjunction' : 'disjunction') }) : level.name;
        });
        return fill(labels.approvalWaiting, { who: who.join('; ') });
      }
      case 'needed': {
        const names = asked.map((level) => level.name);
        const levelsWords = approval.together ? joined(names) : names.reduce((first, next) => fill(labels.approvalThen, { first, next }));
        return fill(labels.approvalNeeded, { levels: levelsWords });
      }
      case 'approved':
        return labels.approvalApproved;
      case 'rejected': {
        const at = asked.find((level) => level.state === 'rejected');
        const entry = [...approval.history].reverse().find((one) => one.decision === 'rejected');
        const name = entry?.by ?? (at ? decidedBy(at, 'rejected')[0] : undefined);
        const level = at?.name ?? levelName(approval, entry?.level, entry);
        return name ? fill(labels.approvalRejectedBy, { name, level }) : fill(labels.approvalRejected, { level });
      }
      default:
        return '';
    }
  }

  /** A level in its row: its name, and its state with who decided there. */
  function levelItem(level: ApprovalLevel): HTMLElement {
    const approved = decidedBy(level, 'approved');
    const state =
      level.state === 'approved' ? (approved.length ? fill(labels.approvalLevelApproved, { names: joined(approved) }) : labels.approvalApproved)
      : level.state === 'rejected' ? fill(labels.approvalLevelRejected, { names: joined(decidedBy(level, 'rejected')) })
      : level.state === 'waiting' ? (approved.length ? fill(labels.approvalLevelWaitingSome, { names: joined(approved) }) : labels.approvalLevelWaiting)
      : level.state === 'skipped' ? labels.approvalLevelSkipped
      : labels.approvalLevelLater;
    return el('li', { class: 'fd-approval-level', 'data-state': level.state }, el('span', { class: 'fd-approval-level-mark', 'aria-hidden': 'true' }), el('span', { class: 'fd-approval-level-name' }, level.name), el('span', { class: 'fd-approval-level-state' }, state));
  }

  /** A moment of its history: who did what, when, and why. */
  function historyItem(approval: FormApproval, entry: ApprovalEntry): HTMLElement {
    const level = levelName(approval, entry.level, entry);
    const what = entry.decision === 'requested' ? fill(labels.approvalAskedEntry, { name: entry.by }) : fill(entry.decision === 'approved' ? labels.approvalApprovedEntry : labels.approvalRejectedEntry, { name: entry.by, level });
    const at = formApprovalsPart.loaded?.approvalWhen(entry.at, ctx.messages, page) ?? entry.at;
    const item = el('li', { class: 'fd-approval-entry', 'data-decision': entry.decision }, el('span', { class: 'fd-approval-entry-what' }, what), el('time', { class: 'fd-approval-entry-at', datetime: entry.at }, at));
    if (entry.reason) item.append(el('q', { class: 'fd-approval-entry-reason' }, entry.reason));
    return item;
  }

  /** What stays open while it waits, where the page locks it and the person may change it at all. */
  function openWords(state: FormState): string {
    const own = page.approval;
    if (!own || own.lock === false || state.approval?.status !== 'waiting' || state.can?.edit === false) return '';
    const named = (own.open ?? []).filter((name) => page.fields[name]);
    if (!named.length) return labels.approvalLockedAll;
    const cased = labelAt(labels.approvalOpen, 'fields', page.lowerLabels, locale);
    return fill(labels.approvalOpen, { fields: joined(named.map((name) => cased(page.fields[name].label))) });
  }

  /** Approve and Reject for each level this person may decide now: named by their level where there are several. */
  function drawButtons(approval: FormApproval) {
    const several = approval.mine.length > 1;
    buttons.replaceChildren(
      ...approval.mine.flatMap((id) => {
        const name = levelName(approval, id);
        const approve = el('button', { type: 'button', class: 'fd-button fd-button-primary', 'data-level': id, 'data-decide': 'approved' }, several ? fill(labels.approvalApproveFor, { level: name }) : labels.approvalApprove);
        const reject = el('button', { type: 'button', class: 'fd-button fd-button-danger', 'data-level': id, 'data-decide': 'rejected' }, several ? fill(labels.approvalRejectFor, { level: name }) : labels.approvalReject);
        approve.addEventListener('click', () => void decide(approve, id, name, 'approved'));
        reject.addEventListener('click', () => void askWhy(reject, id, name));
        return [approve, reject];
      })
    );
  }

  /** A decision taken: said once done, or why not, beside the buttons; the buttons busy meanwhile. */
  async function decide(button: HTMLElement, level: string, name: string, decision: ApprovalDecision, reasonGiven?: string): Promise<string | null> {
    if (button.getAttribute('aria-busy') === 'true') return null;
    setAttr(button, 'aria-busy', 'true');
    setText(said, '');
    ctx.announce(decision === 'approved' ? labels.approvalApproving : labels.approvalRejecting);
    try {
      await form.decide(level, decision, reasonGiven);
      ctx.announce(fill(decision === 'approved' ? labels.approvalApprovedFor : labels.approvalRejectedFor, { level: name }));
      return null;
    } catch (error) {
      const why = fill(decision === 'approved' ? labels.approvalApproveFailed : labels.approvalRejectFailed, { why: error instanceof Error ? error.message : String(error) });
      if (reasonGiven === undefined) setText(said, why);
      return why;
    } finally {
      button.removeAttribute('aria-busy');
    }
  }

  /**
   * Reject's question: why, in a box of its own — kept in the record's history — with Cancel and Reject. A rejection
   * with no reason is refused under the box, and one the source refuses is said there; the question stays, the reason
   * kept. Escape cancels; Ctrl+Enter rejects.
   */
  function askWhy(opener: HTMLElement, level: string, name: string) {
    const id = `${prefix}-reject`;
    const heading = el('h2', { class: 'fd-approval-reject-title', id: `${id}-title` }, sentence(labels.approvalRejectTitleNoun, labels.approvalRejectTitle));
    const ask = el('p', { class: 'fd-approval-reject-ask', id: `${id}-ask` }, fill(labels.approvalRejectAsk, { level: name }));
    const box = el('textarea', { class: 'fd-input', id: `${id}-box`, rows: '3', 'aria-describedby': `${id}-ask ${id}-error`, 'aria-required': 'true' }) as HTMLTextAreaElement;
    const error = el('p', { class: 'fd-error', id: `${id}-error`, hidden: '' });
    const cancel = el('button', { type: 'button', class: 'fd-button' }, labels.cancel);
    const confirm = el('button', { type: 'button', class: 'fd-button fd-button-danger' }, labels.approvalReject);
    const dialog = el(
      'div',
      { class: 'fd-dialog fd-approval-reject', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': heading.id },
      heading,
      ask,
      el('label', { class: 'fd-label', for: box.id }, labels.approvalRejectReason),
      box,
      error,
      el('div', { class: 'fd-actions fd-actions-end' }, cancel, confirm)
    );
    const backdrop = el('div', { class: 'fd-dialog-backdrop' }, dialog);
    const close = () => {
      backdrop.remove();
      // Back to the button pressed where it still shows; else to the band's first button, or the band.
      const back = opener.isConnected && !opener.closest('[hidden]') ? opener : (buttons.querySelector<HTMLElement>('button') ?? toggle);
      back.focus();
    };
    const refuse = (words: string) => {
      error.textContent = words;
      error.hidden = false;
      setAttr(box, 'aria-invalid', 'true');
      box.focus();
    };
    const send = async () => {
      const given = box.value.trim();
      if (!given) return refuse(ctx.messages.approvalReasonNeeded);
      setAttr(confirm, 'aria-busy', 'true');
      const failed = await decide(opener, level, name, 'rejected', given);
      confirm.removeAttribute('aria-busy');
      if (failed) return refuse(failed);
      close();
    };
    cancel.addEventListener('click', close);
    confirm.addEventListener('click', () => void (confirm.getAttribute('aria-busy') === 'true' ? undefined : send()));
    box.addEventListener('input', () => {
      if (error.hidden) return;
      error.hidden = true;
      box.removeAttribute('aria-invalid');
    });
    // Its keys are its own: Escape cancels here and closes no dialog under it; Tab stays in it.
    backdrop.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        void send();
      } else keepTabIn(dialog, event);
    });
    ctx.root.append(backdrop);
    box.focus();
  }

  /** What was drawn last, so a state that changes nothing of it draws nothing again. */
  let drawn: FormApproval | null | undefined;
  let openDrawn = '';
  return {
    element,
    update(state) {
      const approval = state.approval ?? null;
      const openNow = openWords(state);
      if (openNow !== openDrawn) {
        openDrawn = openNow;
        setText(open, openNow);
        setHidden(open, !openNow);
      }
      if (approval === drawn) return;
      const before = drawn;
      drawn = approval;
      // Nothing told yet for the record shown — new, asked, none needed: nothing shows.
      const failed = approval?.state === 'failed';
      const shown = !!approval && (failed || approval.status !== 'none');
      setHidden(element, !shown);
      if (!approval || !shown) {
        if (!approval || before?.levels !== approval.levels) setText(said, '');
        return;
      }
      element.setAttribute('data-status', failed ? 'failed' : approval.status);
      setAttr(element, 'aria-busy', approval.state === 'asking' ? 'true' : null);
      setText(title, failed ? fill(labels.approvalFailed, { why: approval.error ?? '' }) : headline(approval));
      setHidden(retry, !failed);
      setText(why, failed ? '' : (approval.why ?? ''));
      setHidden(why, failed || !approval.why);
      const rejection = approval.status === 'rejected' ? [...approval.history].reverse().find((entry) => entry.decision === 'rejected')?.reason : undefined;
      setText(reason, rejection ?? '');
      setHidden(reason, !rejection);
      // The levels, their buttons and the history, drawn again only when what they say changed.
      if (before?.levels !== approval.levels || before?.mine !== approval.mine) {
        levels.replaceChildren(...approval.levels.map(levelItem));
        setHidden(levels, !approval.levels.length);
        drawButtons(approval);
      }
      if (before?.history !== approval.history) {
        history.replaceChildren(...approval.history.map((entry) => historyItem(approval, entry)));
        setText(toggle, fill(labels.approvalHistoryCount, { n: approval.history.length }));
        setHidden(toggle, !approval.history.length);
        if (!approval.history.length) {
          history.hidden = true;
          toggle.setAttribute('aria-expanded', 'false');
        }
      }
    },
  };
}
