import { fill, type FormState, type Locale } from '@fieldia/core';
import { setHidden, setText } from './dom';
import type { FlowContext } from './survey-flow';

/**
 * A time limit's countdown (`timeLimit` on a page of responses or a step of its wizard), the survey part's: a page's
 * limit said before its questions with Start — its clock starting as Start is pressed — then "Time left 12:34" over the
 * questions, a step's said at its head as it is entered; a warning said once as it nears its end, and as it runs out
 * what happened, as the page says: the answers sent as they stood, or locked for the person to send — a step's kept as
 * they are while the form goes on. Its clock is the form's (`now`); the countdown reads it every second while one runs.
 */

export interface TimerHooks {
  /** The time ran out on a page whose answers go then: they are sent as they stand. */
  sendNow(): Promise<void>;
  /** A page's own words as they read with the answers given. */
  words(text: string): string;
}

export interface TimerKit {
  /** Whether the questions wait for Start: a page's limit not started. */
  waiting(): boolean;
  update(state: FormState): void;
  destroy(): void;
}

/** A span of time as words in the page's language: "20 minutes", "1 minute, 30 seconds" — Latin digits, as everywhere. */
export function timeWords(ms: number, locale: Locale): string {
  const seconds = Math.round(ms / 1000);
  const unit = (n: number, of: 'hour' | 'minute' | 'second') => new Intl.NumberFormat(locale, { style: 'unit', unit: of, unitDisplay: 'long', numberingSystem: 'latn' } as Intl.NumberFormatOptions).format(n);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const parts = [...(hours ? [unit(hours, 'hour')] : []), ...(minutes ? [unit(minutes, 'minute')] : []), ...(rest || (!hours && !minutes) ? [unit(rest, 'second')] : [])];
  return parts.join(' ');
}

/** What is left as a clock reads it: 12:34, or 1:02:03 past an hour. */
export function clockWords(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  const two = (n: number) => String(n).padStart(2, '0');
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}:${two(minutes)}:${two(seconds % 60)}` : `${minutes}:${two(seconds % 60)}`;
}

export function timeKeeper(context: FlowContext, hooks: TimerHooks): TimerKit {
  const { el, page, form, labels, locale, questions } = context;
  const whole = page.timeLimit;
  const cleanups: (() => void)[] = [];

  // ---- before a page's limit starts: what it allows, and Start ---------------------------------------------------
  const startWords = el('p', { class: 'fd-time-start-words' }, fill(labels.timeLimitIntro, { time: timeWords((whole?.minutes ?? 0) * 60_000, locale) }));
  const start = el('button', { type: 'button', class: 'fd-button fd-button-primary fd-time-start-button' }, labels.timeStart);
  const startPanel = el('div', { class: 'fd-time-start', hidden: '' }, el('p', { class: 'fd-time-start-title' }, labels.timeLimitTitle), startWords, start);
  if (whole) questions.before(startPanel);
  start.addEventListener('click', () => {
    form.startTimer();
    questions.querySelector<HTMLElement>('input:not([type="hidden"]), select, textarea, [role="radio"]')?.focus();
  });

  // ---- the countdown ---------------------------------------------------------------------------------------------
  const clock = el('span', { class: 'fd-time-clock' });
  const said = el('span', { class: 'fd-time-said' });
  // A timer, read when asked: never every second aloud. What it warns of is said once (`announce`).
  const countdown = el('div', { class: 'fd-time-bar', role: 'timer', 'aria-live': 'off', hidden: '' }, el('span', { class: 'fd-time-left' }, clock), said);
  questions.before(countdown);
  cleanups.push(() => {
    startPanel.remove();
    countdown.remove();
  });

  let ticking: ReturnType<typeof setInterval> | null = null;
  const stop = () => {
    if (ticking !== null) clearInterval(ticking);
    ticking = null;
  };
  cleanups.push(stop);
  /** Each scope's warning and end, said once. */
  const warned = new Set<string>();
  const ended = new Set<string>();

  /** What the time's running out last said, kept in the bar until a clock runs again. */
  let lastSaid = '';
  function draw(state: FormState) {
    // Started again (another response): nothing said yet of its clocks.
    if (!state.timeUp.length && !Object.keys(state.timers).length && (ended.size || warned.size)) {
      ended.clear();
      warned.clear();
      lastSaid = '';
    }
    // Each limit run out, said once — on the page, and to a screen reader: sent as it stood, locked, a step's kept.
    for (const scope of state.timeUp) {
      if (ended.has(scope)) continue;
      ended.add(scope);
      const then = scope === '#form' ? (whole?.then ?? 'send') : (page.layout.type === 'wizard' ? page.layout.children.find((step) => step.id === scope)?.timeLimit?.then : undefined) ?? 'lock';
      lastSaid = then === 'send' ? labels.timeUpSent : scope !== '#form' ? labels.stepTimeUp : fill(labels.timeUpLocked, { send: hooks.words(page.layout.type === 'wizard' ? page.layout.finishLabel ?? labels.submit : labels.submit) });
      context.announce(lastSaid);
      if (then === 'send')
        void hooks.sendNow().then(() => {
          // Said on the thanks too: the answers went as they stood.
          const thanks = questions.closest('.fd-form')?.querySelector<HTMLElement>('.fd-done');
          if (!thanks || thanks.hidden || thanks.querySelector('.fd-time-done')) return;
          thanks.querySelector('.fd-done-title')?.after(el('p', { class: 'fd-time-done', role: 'status' }, labels.timeUpSent));
        });
    }
    const showing = form.countdown();
    const waiting = !!whole && state.timers['#form'] === undefined && !state.timeUp.includes('#form') && !state.sent;
    setHidden(startPanel, !waiting);
    if (showing && showing.stage !== 'up') lastSaid = '';
    setText(said, lastSaid);
    if (state.sent || (!showing && !lastSaid)) {
      setHidden(countdown, true);
      return stop();
    }
    setHidden(countdown, false);
    countdown.dataset['stage'] = showing?.stage ?? 'up';
    setText(clock, showing && showing.stage !== 'up' ? fill(showing.scope !== '#form' ? labels.stepTimeLeft : labels.timeLeft, { time: clockWords(showing.left) }) : '');
    if (showing?.stage === 'warning' && !warned.has(showing.scope)) {
      warned.add(showing.scope);
      context.announce(fill(labels.timeWarn, { time: timeWords(showing.left, locale) }));
    }
    if (!showing || showing.stage === 'up') stop();
    else if (ticking === null) ticking = setInterval(() => draw(form.getState()), 1000);
  }

  return {
    waiting: () => !!whole && form.getState().timers['#form'] === undefined && !form.getState().timeUp.includes('#form'),
    update: draw,
    destroy() {
      for (const cleanup of cleanups) cleanup();
    },
  };
}
