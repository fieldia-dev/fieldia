import { evidenceOf, labelAt, type FieldNode, type FileValue, type Form, type Locale, type Value, type Values, intlFormat, plainPart } from '@fieldia/core';
import { fillIn, maker, setAttr, setHidden, setText } from './kind-parts';
import type { WidgetLabels } from './labels';
import { restingText, zoneOf } from './date-text';
import { answersToSign, canonicalJson, sha256Hex, signAnswers, signatureText, signedAnswers, SIGNATURE_FORMAT } from './signature-evidence';
import { installEvidenceStyles } from './styles-evidence';

/**
 * A signature that signs answers (`options.signs`), as the evidence part gives it to the files part's signature
 * (signature.ts), which draws the pad and keeps the picture whether or not this part has come:
 *
 * - **Signing.** A picture kept, the answers it signs are read as typed first (`settle`); an answer still to give, or
 *   text that does not read, is named under the pad and the picture let go — nothing signed. Else who (the field
 *   `options.signerField` names, the name typed, or the form's `user`), when (the form's clock), which answers and their
 *   fingerprint (signature-evidence.ts) are kept with the picture (`FileValue.signed`), laid only while the record is
 *   the one shown, the picture still the field's and this the latest signing; an answer changed while the fingerprint
 *   was made is read again.
 * - **Under the signature.** "Signed by Mona Adel, 19 Oct 2026, 11:42" on the page's clock, whether the answers are as
 *   signed — the fingerprint made again from them as they change — and Change answers, asked in place (the focus on
 *   Keep, Escape keeps), which takes the signature away: the form locks the answers it signed while it is kept (core's
 *   signed.ts).
 */

/** What the signature gives its evidence: the field, its words, and its ways to say, let go and take away. */
export interface SigningContext {
  form: Form;
  name: string;
  node: FieldNode;
  document: Document;
  words: WidgetLabels;
  locale?: Locale;
  /** Said under the pad, politely: why nothing was signed, or (`news`) what was done; empty, nothing. */
  say(text: string, news?: boolean): void;
  /** Not signed: the picture is the field's no longer; what was drawn stays on the pad. */
  letGo(): void;
  /** Taken away by Change answers: the pad wiped, the value let go, the focus in the name box. */
  takeAway(): void;
  /** Whether something is on the pad: strokes drawn, or a name typed. */
  drawn(): boolean;
  /** What is on the pad kept as the picture, and signed: the drawing a refused signing left there. */
  signDrawn(): void;
}

/** A signature's evidence: its line under the signature, its signing, and the line kept to the value. */
export interface Signing {
  element: HTMLElement;
  /** Sign now, under the note, once a drawing refused for answers to put right can be signed: placed by the signature. */
  prompt: HTMLElement;
  /** The answers signed with this picture, once what is typed in them is read (`settle`); laid while `current` holds. */
  sign(picture: FileValue, how: { settle(): Promise<void>; current(): boolean }): Promise<void>;
  update(value: Value | undefined, values: Readonly<Values>, readonly: boolean): void;
}

export function signingFor(context: SigningContext): Signing {
  const { form, name, node, document, words, locale } = context;
  installEvidenceStyles(document);
  const make = maker(document);
  // Who signed and when, whether the answers are as signed, and the way to change them: asked first, in place.
  const signedWho = make('span', { class: 'fd-signature-who' });
  const signedMark = make('span', { 'aria-hidden': 'true' });
  const signedWords = make('span');
  const signedState = make('span', { class: 'fd-signature-state', role: 'status', hidden: '' }, signedMark, signedWords);
  const change = make('button', { type: 'button', class: 'fd-button fd-button-link fd-signature-change', hidden: '' }, words.changeAnswers);
  const yes = make('button', { type: 'button', class: 'fd-button fd-button-link' }, words.changeAnswers);
  const no = make('button', { type: 'button', class: 'fd-button fd-button-link' }, words.keep);
  const question = make('div', { class: 'fd-file-confirm fd-signature-ask', hidden: '' }, make('span', {}, words.changeAnswersAsk), yes, no);
  const element = make('div', { class: 'fd-signature-evidence', hidden: '' }, signedWho, signedState, change, question);

  /** Who signs: the field the page names for the signer, the name typed on the pad, or the person using the form. */
  function signer(typedText: string | undefined): string | undefined {
    const from = node.options?.['signerField'];
    const named = typeof from === 'string' ? form.getState().values[from] : null;
    const text = typeof named === 'string' ? named : named && typeof named === 'object' && !Array.isArray(named) && 'label' in named ? String(named.label) : '';
    return text.trim() || typedText?.trim() || form.user()?.name?.trim() || undefined;
  }

  /** The answers it signs, shown now, and those of them to put right first: still to give, or text that does not read. */
  function toPutRight(): { fields: string[]; wrong: string[] } {
    const fields = answersToSign(form.page, node, form.shownFields());
    const unread = Object.keys(form.getState().unread);
    return { fields, wrong: fields.filter((field) => form.problem(field) !== null || unread.some((path) => path.startsWith(`${field}.`))) };
  }

  /** "Not signed yet: first put right …", naming the answers `wrong`. */
  function notSignedWords(wrong: string[]): string {
    const asLabel = labelAt(words.notSignedYet, 'fields', form.page.lowerLabels, locale);
    const labelsOf = wrong.map((field) => asLabel(plainPart(form.page.fields[field])?.label ?? field));
    let list: string;
    try {
      list = intlFormat('ListFormat', locale ?? 'en', { type: 'conjunction' }).format(labelsOf);
    } catch {
      list = labelsOf.join(', ');
    }
    return fillIn(words.notSignedYet, { fields: list });
  }

  /**
   * A drawing refused for answers to put right, still on the pad: the note follows the answers — those left named, and
   * once none is, that they are ready, with Sign now, which signs that drawing (signing is the person's own act: never
   * done for them as the last answer is put right, which would lock the answers under their hands).
   */
  let waiting = false;
  const prompt = make('button', { type: 'button', class: 'fd-button fd-signature-sign-now', hidden: '' }, words.signNow);
  prompt.addEventListener('click', () => {
    setHidden(prompt, true);
    context.signDrawn();
  });

  /** Not signed: the answers to put right named, each saying its own problem, and the picture let go. */
  function refuse(wrong: string[]) {
    context.letGo();
    for (const field of wrong) form.boxLeft(field);
    waiting = true;
    setHidden(prompt, true);
    context.say(notSignedWords(wrong));
  }

  /** What a refused drawing's note says now: what is left to put right, or that the answers are ready to sign. */
  function follow(value: Value | undefined, readonly: boolean) {
    if (!waiting) return;
    // Signed since, its signing on its way, or the pad cleared: there is nothing more to say of the drawing refused.
    if (value || readonly || !context.drawn()) {
      if (value && !evidenceOf(value)) return setHidden(prompt, true);
      waiting = false;
      setHidden(prompt, true);
      if (!value) context.say('');
      return;
    }
    const { wrong } = toPutRight();
    context.say(wrong.length ? notSignedWords(wrong) : words.readyToSign);
    setHidden(prompt, wrong.length > 0);
  }

  async function sign(picture: FileValue, how: { settle(): Promise<void>; current(): boolean }): Promise<void> {
    for (let tries = 0; tries < 3; tries++) {
      await how.settle();
      if (!how.current()) return;
      const { fields, wrong } = toPutRight();
      if (wrong.length) return refuse(wrong);
      const values = form.getState().values;
      const signed = await signAnswers({ page: form.page, field: name, values, fields, by: signer(picture.text), at: form.now() });
      if (!how.current()) return;
      const now = form.getState().values;
      if (tries < 2 && now !== values && canonicalJson(signedAnswers(form.page, now, fields)) !== canonicalJson(signedAnswers(form.page, values, fields))) continue;
      waiting = false;
      setHidden(prompt, true);
      context.say('');
      form.setValue(name, { ...picture, signed });
      return;
    }
  }

  /** The evidence's fingerprint last made again from the answers, and whether it matched. */
  let checked: { key: string; matches: boolean | null } | null = null;

  function drawMatch() {
    const matches = checked?.matches;
    setHidden(signedState, matches === null || matches === undefined);
    setAttr(signedState, 'data-changed', matches === false ? '' : null);
    setText(signedMark, matches ? '✓' : '⚠');
    setText(signedWords, matches ? words.answersAsSigned : words.answersChanged);
  }

  // Asked in place, its own button out of sight meanwhile: one Change answers at a time.
  change.addEventListener('click', () => {
    setHidden(question, false);
    setHidden(change, true);
    no.focus();
  });
  const keepIt = () => {
    setHidden(question, true);
    setHidden(change, false);
    change.focus();
  };
  no.addEventListener('click', keepIt);
  question.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    keepIt();
  });
  // Taken away: the answers it signed can be changed, and signed again.
  yes.addEventListener('click', () => {
    setHidden(question, true);
    context.takeAway();
    context.say(words.signatureTakenAway, true);
  });

  return {
    element,
    prompt,
    sign,
    /** Who signed and when, and whether the answers are still as signed: their fingerprint made again from them now. */
    update(value, values, readonly) {
      follow(value, readonly);
      const evidence = evidenceOf(value);
      if (readonly || !evidence) setHidden(question, true);
      setHidden(change, readonly || !evidence || !question.hidden);
      setHidden(element, !evidence);
      if (!evidence) {
        checked = null;
        return;
      }
      // Its day and time kept together on one line, wherever the words wrap.
      const [before, after = ''] = fillIn(evidence.by ? words.signedByName : words.signedAt, { name: evidence.by ?? '' }).split('{when}');
      const when = restingText(evidence.at, 'datetime', locale ?? 'en', zoneOf(form));
      if (signedWho.textContent !== before + when + after) signedWho.replaceChildren(before, make('span', { class: 'fd-signature-when' }, when), after);
      // A fingerprint in a form this Fieldia does not write is not said either way.
      const text = evidence.format === SIGNATURE_FORMAT ? signatureText({ page: form.page.id, field: name, at: evidence.at, ...(evidence.by ? { by: evidence.by } : {}), answers: signedAnswers(form.page, values, evidence.fields) }) : null;
      const key = `${evidence.sha256} ${text}`;
      if (text === null) checked = null;
      else if (checked?.key !== key) {
        // Said only while the evidence and the answers are those it was made from — whatever record shows them: it
        // writes nothing on the record, so a record shown again meanwhile is told it as well.
        const asked: { key: string; matches: boolean | null } = (checked = { key, matches: null });
        void sha256Hex(text).then((hash) => {
          if (checked !== asked) return;
          asked.matches = hash === evidence.sha256;
          drawMatch();
        });
      }
      drawMatch();
    },
  };
}
