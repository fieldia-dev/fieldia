import { takingWords, type Form, type FormState, type Messages, type Page, type SavedDraft } from '@fieldia/core';
import { setHidden, setText, type El } from './dom';
import type { ViewerLabels } from './labels';
import { installLimitsStyles } from './limits-styles';

/**
 * A page's opening, closing and limits, and "Continue later" — the limits part (`limits`, `continueLater` on a page):
 *
 * - **A closed form says so as it opens**, in place of its questions: before it opens ("This form opens on 1 November
 *   2026 at 09:00."), after it closed, with all its responses taken, or this person's one sent — and the page's own
 *   words under it (`limits.message`). Nothing is typed in a form that would refuse it: while its counts are asked of
 *   the data source, its questions wait. A form that closes while answers are typed keeps them on screen, a banner
 *   over them saying they can no longer be sent; the form refuses them as they go.
 * - **Continue later**: a button beside Submit (and a wizard's Next) where the source keeps drafts. Pressed, what is
 *   typed is read and kept on the app's server (`form.continueLater`), and the questions give way to "Your answers
 *   are saved", the link the app made to continue from with Copy, the app's own words, and Keep going.
 * - A draft opened by its key that names none: a note that the form starts empty.
 */

/** What the limits part needs of the viewer that draws the page. */
export interface LimitsContext {
  form: Form;
  /** The page as shown: its words in the page's language. */
  page: Page;
  doc: Document;
  el: El;
  labels: ViewerLabels;
  /** The form's messages, in the page's language: why it takes no answers. */
  messages: Messages;
  fill(template: string, values: Record<string, string | number>): string;
  /**
   * The page's questions and their buttons, once drawn — never its title — given way to while it takes no answers and
   * nothing is typed, and while Continue later says what it kept.
   */
  content(): HTMLElement | null;
  /** Whether the page's Thank you shows: nothing of this does then. */
  done(): boolean;
  /** Words said at once to a screen reader. */
  announce(text: string): void;
}

/** What the viewer places of it: before its questions, after them, and the button among its own. */
export interface LimitsKit {
  /** Over the questions: the banner of a form that closed as answers were typed, and the note of a draft not found. */
  before: HTMLElement[];
  /** Right after them, standing in their place: the closed form's words, and what Continue later kept. */
  after: HTMLElement[];
  /** Continue later, for the page's actions — its button, and why it could not keep them — null where the page or its source offers none. */
  later: HTMLElement | null;
  update(state: FormState): void;
}

export function drawLimits(ctx: LimitsContext): LimitsKit {
  const { form, page, el, labels } = ctx;
  installLimitsStyles(ctx.doc);
  const title = el('p', { class: 'fd-closed-title' });
  const own = el('p', { class: 'fd-closed-message' });
  const screen = el('div', { class: 'fd-closed', role: 'status', hidden: '' }, title, own);
  const bannerText = el('span', { class: 'fd-banner-text' });
  const banner = el('div', { class: 'fd-banner fd-tone-warning fd-closed-banner', role: 'alert', hidden: '' }, bannerText);
  const missing = el('div', { class: 'fd-draft fd-resume-missing', role: 'status', hidden: '' }, labels.resumeMissing);
  const later = form.canContinueLater() ? laterKit(ctx) : null;
  /** Whether the questions were put away by this part — for a closed form, or what was kept — and so are its to bring back. */
  let away = false;
  const aside = (hide: boolean) => {
    const content = ctx.content();
    if (!content) return;
    if (hide && !content.hidden) {
      content.hidden = true;
      away = true;
    } else if (!hide && away) {
      content.hidden = false;
      away = false;
    }
  };
  return {
    before: [banner, missing],
    after: [screen, ...(later ? [later.panel] : [])],
    later: later?.box ?? null,
    update(state) {
      const limits = state.limits;
      const why = takingWords(page, limits, ctx.messages);
      const asking = limits?.state === 'asking';
      const typed = state.dirty.length > 0 || Object.keys(state.unread).length > 0;
      const quiet = ctx.done() || !!later?.open();
      const closed = !quiet && (asking || (!!why && !typed));
      setText(title, asking ? labels.loading : why ?? '');
      setText(own, limits?.message ?? '');
      setHidden(own, asking || !limits?.message);
      setHidden(screen, !closed);
      screen.toggleAttribute('aria-busy', asking);
      setText(bannerText, why ? `${why} ${labels.closedTyped}` : '');
      setHidden(banner, quiet || !why || !typed);
      setHidden(missing, !state.resume?.missing);
      if (!later?.open()) aside(closed);
    },
  };

  /** Continue later's button, and what it shows once the answers are kept: the link, Copy, the app's words, Keep going. */
  function laterKit({ form: own, doc, el: make, labels: words, fill, announce, content: questions }: LimitsContext) {
    const button = make('button', { type: 'button', class: 'fd-button fd-later-button' }, words.laterButton);
    const said = make('span', { class: 'fd-later-said', role: 'alert' });
    const heading = make('p', { class: 'fd-later-title', tabindex: '-1' }, words.laterSaved);
    const linkWords = make('p', { class: 'fd-later-words' });
    const link = make('input', { type: 'text', class: 'fd-input fd-later-link', readonly: '', 'aria-label': words.laterLinkName }) as HTMLInputElement;
    const copy = make('button', { type: 'button', class: 'fd-button' }, words.laterCopy);
    const linkRow = make('div', { class: 'fd-later-row' }, link, copy);
    const appWords = make('p', { class: 'fd-later-message' });
    const back = make('button', { type: 'button', class: 'fd-button fd-button-primary' }, words.laterBack);
    const panel = make('div', { class: 'fd-later', hidden: '' }, heading, linkWords, linkRow, appWords, back);
    let showing = false;
    let copied: ReturnType<typeof setTimeout> | undefined;
    button.addEventListener('click', async () => {
      if (button.getAttribute('aria-busy') === 'true') return;
      button.setAttribute('aria-busy', 'true');
      said.textContent = '';
      announce(words.laterSaving);
      try {
        show(await own.continueLater());
      } catch (error) {
        const why = error instanceof Error ? error.message : String(error);
        said.textContent = fill(words.laterFailed, { why });
      } finally {
        button.removeAttribute('aria-busy');
      }
    });
    function show(saved: SavedDraft) {
      setText(linkWords, saved.link ? words.laterLink : words.laterAgain);
      link.value = saved.link ?? '';
      setHidden(linkRow, !saved.link);
      setText(appWords, saved.message ?? '');
      setHidden(appWords, !saved.message);
      setText(copy, words.laterCopy);
      showing = true;
      const content = questions();
      if (content) content.hidden = true;
      away = true;
      panel.hidden = false;
      heading.focus();
    }
    copy.addEventListener('click', () => {
      // Copied where the browser lets the page; else chosen in its box, for the person to copy.
      const done = () => {
        setText(copy, words.laterCopied);
        announce(words.laterCopied);
        clearTimeout(copied);
        copied = setTimeout(() => setText(copy, words.laterCopy), 2500);
      };
      const clipboard = doc.defaultView?.navigator.clipboard;
      if (!clipboard) return link.select();
      clipboard.writeText(link.value).then(done, () => link.select());
    });
    back.addEventListener('click', () => {
      showing = false;
      panel.hidden = true;
      const content = questions();
      if (content) content.hidden = false;
      away = false;
      button.focus();
    });
    return { box: make('span', { class: 'fd-later-box' }, button, said), panel, open: () => showing };
  }
}
