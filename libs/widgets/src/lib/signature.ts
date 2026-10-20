import { evidenceOf, fileProblem, labelAt, MESSAGES, type FileValue, type Value, type Values } from '@fieldia/core';
import { readFile } from './files';
import { stillShown, whileShown } from './shown';
import { goingList } from './files-going';
import { shrinkFor, shrinkPhoto } from './shrink';
import { describeState, fillIn, maker, setAttr, setHidden, setText, wordsFor } from './kind-parts';
import type { WidgetFactory } from './widgets';
import { installFilesStyles } from './styles-files';
import { restingText, zoneOf } from './date-text';
import { answersToSign, canonicalJson, sha256Hex, signAnswers, signatureText, signedAnswers, SIGNATURE_FORMAT } from './signature-evidence';

/**
 * A signature on a file field (`binary.signature`): drawn on a pad with a
 * mouse, a finger or a pen, or — for anyone without a pointer — typed as a
 * name and drawn as a signature, the name kept as the value's `text`. Kept
 * as a PNG picture, the value a file upload has. A signature already kept
 * shows as its picture until Clear. Undo takes the last stroke away.
 *
 * `options.color` (#rrggbb) and `options.penWidth` set the pen; the node's
 * `placeholder` is the words on the blank pad ("Sign here"); `options.footerLabel`
 * the words kept under it; `options.upload` lets a picture of a signature be
 * uploaded as a third way — checked as a file field checks one: a picture
 * (or the kinds the field takes), no larger than its `maxSize`. A file
 * refused keeps the signature there was, and says which and why.
 *
 * `options.signs` makes it sign answers — `"form"`, every answer shown, or
 * the fields by name — and `options.signerField` names the field holding the
 * signer's name. Signed, it keeps who (that field's name, else the name typed,
 * else the person using the form), when (the form's clock) and the answers'
 * fingerprint beside its picture (`FileValue.signed`, signature-evidence.ts),
 * once what was typed in them is read: an answer that does not read, or is
 * still to be given, is said, and nothing is signed. Under it: "Signed by Mona
 * Adel, 19 Oct 2026, 10:42", whether the answers are still as signed — the
 * fingerprint made again from them — and Change answers, which asks, then
 * takes the signature away: the form locks the answers it signed while it is
 * kept (core's signed.ts).
 *
 * It comes in the files part (files-part.ts), with a file field's uploads.
 */

/** The pad's own size, in the picture's pixels; it is drawn at whatever width its box has. */
const WIDTH = 600;
const HEIGHT = 180;
/** Blue-black ink on a clear ground, so the picture reads on any paper. */
const INK = '#1b2a5c';
const SCRIPT = '"Segoe Script", "Snell Roundhand", "Brush Script MT", "Apple Chancery", cursive';

/** The bytes a base64 text holds. */
const bytesOf = (base64: string) => Math.floor((base64.length * 3) / 4) - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
const keyOf = (file: FileValue) => file.data ?? file.url ?? '';
type Point = { x: number; y: number };

export const signatureWidget: WidgetFactory = ({ form, name, field, node, id, document, labels, locale }) => {
  installFilesStyles(document);
  const words = wordsFor(labels, locale);
  const make = maker(document);
  const options = node.options ?? {};
  const color = options['color'];
  const ink = typeof color === 'string' && /^#[\da-f]{6}$/i.test(color) ? color : INK;
  const penWidth = options['penWidth'];
  const width = typeof penWidth === 'number' && penWidth > 0 ? penWidth : 3;
  const footerWords = options['footerLabel'];
  const signs = options['signs'];
  /** Whether it signs answers: who, when and their fingerprint kept with it, and those answers locked while it is. */
  const evidencing = signs === 'form' || (Array.isArray(signs) && signs.length > 0);
  const canvas = make('canvas', { class: 'fd-signature-pad', width: String(WIDTH), height: String(HEIGHT), role: 'img', 'aria-label': words.signaturePad });
  const hint = make('span', { class: 'fd-signature-hint', 'aria-hidden': 'true' }, node.placeholder || words.signHere);
  const image = make('img', { class: 'fd-signature-image', alt: field.label, hidden: '' });
  const typed = make('input', { type: 'text', class: 'fd-input fd-signature-typed', 'aria-label': words.typeSignature, placeholder: words.typeSignature, autocomplete: 'name' });
  const button = (words: string) => make('button', { type: 'button', class: 'fd-button fd-button-link', hidden: '' }, words);
  const undo = button(words.undo);
  const clear = button(words.clearDrawing);
  clear.classList.add('fd-signature-clear');
  // A picture of a signature, from this computer or a phone's camera.
  const upload = options['upload'] === true ? button(words.uploadSignature) : null;
  const file = make('input', { type: 'file', accept: 'image/*', class: 'fd-sr-only', tabindex: '-1', 'aria-hidden': 'true' });
  // Where the data source stores files, a picture uploaded goes to the store as it is picked — made smaller, as a
  // picture field's photos are — and shows on its way under the pad. This listener comes first: the one below, which
  // reads a picture into the record, never hears of it.
  const going = goingList(make, words, form, name);
  file.addEventListener('change', (event) => {
    const chosen = file.files?.[0];
    // A picture that signs answers is read into the record with its evidence first: the save stores it, the evidence kept.
    if (!chosen || !form.canUpload() || evidencing) return;
    event.stopImmediatePropagation();
    file.value = '';
    const shrink = shrinkFor({ ...field, type: 'image' } as typeof field, true);
    form.upload(name, [chosen], shrink ? { prepare: (picked) => shrinkPhoto(picked as File, shrink, document) } : {});
  });
  // Why a picture uploaded was not taken, or answers not signed: said politely, under the pad's tools.
  const refused = make('div', { class: 'fd-help fd-file-note fd-signature-note', role: 'status', hidden: '' });
  // Who signed and when, whether the answers are as signed, and the way to change them: asked first, in place.
  const signedWho = make('span', { class: 'fd-signature-who' });
  const signedMark = make('span', { 'aria-hidden': 'true' });
  const signedWords = make('span');
  const signedState = make('span', { class: 'fd-signature-state', role: 'status' }, signedMark, signedWords);
  const change = make('button', { type: 'button', class: 'fd-button fd-button-link fd-signature-change', hidden: '' }, words.changeAnswers);
  const yes = make('button', { type: 'button', class: 'fd-button fd-button-link' }, words.changeAnswers);
  const no = make('button', { type: 'button', class: 'fd-button fd-button-link' }, words.keep);
  const question = make('div', { class: 'fd-file-confirm fd-signature-ask', hidden: '' }, make('span', {}, words.changeAnswersAsk), yes, no);
  const evidenceBox = make('div', { class: 'fd-signature-evidence', hidden: '' }, signedWho, signedState, change, question);
  const element = make(
    'div',
    { id, class: 'fd-signature', role: 'group' },
    make('div', { class: 'fd-signature-box' }, canvas, image, hint),
    ...(typeof footerWords === 'string' && footerWords ? [make('span', { class: 'fd-signature-footer' }, footerWords)] : []),
    evidenceBox,
    make('div', { class: 'fd-signature-tools' }, typed, undo, ...(upload ? [upload, file] : []), clear),
    refused
  );

  const pen = () => {
    const context = canvas.getContext('2d');
    if (context) {
      context.strokeStyle = context.fillStyle = ink;
      context.lineWidth = width;
      context.lineCap = context.lineJoin = 'round';
    }
    return context;
  };
  /** The picture this pad last kept: coming back from the form, it leaves the pad as it is. */
  let mine: string | null = null;
  let readonly = false;
  /** What is on the pad: a typed name, and the strokes drawn, each its points. */
  let typedName: string | null = null;
  let strokes: Point[][] = [];
  let last: Point | null = null;

  const blank = () => !strokes.length && !typedName;
  /** The pad drawn again from what is on it: the name, then each stroke — a dot for a press that never moved. */
  function redraw() {
    const context = pen();
    if (!context) return;
    context.clearRect(0, 0, WIDTH, HEIGHT);
    if (typedName) {
      context.font = `italic 64px ${SCRIPT}`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(typedName, WIDTH / 2, HEIGHT / 2, WIDTH - 40);
    }
    for (const stroke of strokes) {
      context.beginPath();
      context.arc(stroke[0].x, stroke[0].y, width / 2, 0, Math.PI * 2);
      context.fill();
      for (let i = 1; i < stroke.length; i++) line(stroke[i - 1], stroke[i]);
    }
  }
  function line(from: Point, to: Point) {
    const context = pen();
    context?.beginPath();
    context?.moveTo(from.x, from.y);
    context?.lineTo(to.x, to.y);
    context?.stroke();
  }
  function wipe() {
    strokes = [];
    typedName = null;
    redraw();
  }
  /** What is on the pad, as the field's value: nothing when it is blank. */
  function keep() {
    hint.hidden = !blank();
    if (blank()) {
      mine = null;
      turn++;
      return form.setValue(name, null);
    }
    let url: string | undefined;
    try {
      url = canvas.toDataURL('image/png');
    } catch {
      return; // a pad that cannot be read back keeps nothing
    }
    if (!url) return;
    const data = url.slice(url.indexOf(',') + 1);
    const was = form.getState().values[name];
    const own = was && typeof was === 'object' && keyOf(was as FileValue) === mine;
    mine = data;
    const picture: FileValue = { name: 'signature.png', type: 'image/png', size: bytesOf(data), data, ...(typedName && !strokes.length ? { text: typedName } : {}) };
    // Signed again — a stroke more, a letter of the name — it keeps the answers signed until the new signing is done.
    const before = own ? evidenceOf(was) : null;
    form.setValue(name, before ? { ...picture, signed: before } : picture);
    if (evidencing) sign(picture);
  }

  // ---- signing answers (`options.signs`) ----

  /** The signing on its way, which a save waits for (`settling`), and the turn of the latest: an older one lays nothing. */
  let signing: Promise<void> | null = null;
  let turn = 0;
  /** True while a signing reads what is typed itself: it does not wait for itself. */
  let reading = false;
  const unsettle = evidencing ? form.settling(() => (reading ? undefined : (signing ?? undefined)), () => signing !== null) : null;

  /** Who signs: the field the page names for the signer, the name typed on the pad, or the person using the form. */
  function signer(typedText: string | undefined): string | undefined {
    const from = options['signerField'];
    const named = typeof from === 'string' ? form.getState().values[from] : null;
    const text = typeof named === 'string' ? named : named && typeof named === 'object' && !Array.isArray(named) && 'label' in named ? String(named.label) : '';
    return text.trim() || typedText?.trim() || form.user()?.name?.trim() || undefined;
  }

  /**
   * The answers signed with this picture, once what is typed in them is read: who, when, which and their fingerprint
   * kept with it. Laid only while the record is the one shown, the picture still the field's, and this the latest
   * signing; an answer that changed while its fingerprint was made is read again.
   */
  function sign(picture: FileValue) {
    const ours = ++turn;
    const shown = stillShown(form);
    const current = () => ours === turn && shown() && keyOf((form.getState().values[name] ?? {}) as FileValue) === picture.data;
    const run = async () => {
      for (let tries = 0; tries < 3; tries++) {
        reading = true;
        let read: Promise<void>;
        try {
          read = form.settle();
        } finally {
          reading = false;
        }
        await read;
        if (!current()) return;
        const fields = answersToSign(form.page, node, form.shownFields());
        const unread = Object.keys(form.getState().unread);
        const wrong = fields.filter((field) => form.problem(field) !== null || unread.some((path) => path.startsWith(`${field}.`)));
        if (wrong.length) return refuse(wrong);
        const values = form.getState().values;
        const signed = await signAnswers({ page: form.page, field: name, values, fields, by: signer(picture.text), at: form.now() });
        if (!current()) return;
        const now = form.getState().values;
        if (tries < 2 && now !== values && canonicalJson(signedAnswers(form.page, now, fields)) !== canonicalJson(signedAnswers(form.page, values, fields))) continue;
        setHidden(refused, true);
        form.setValue(name, { ...picture, signed });
        return;
      }
    };
    const going: Promise<void> = run()
      .catch(() => undefined)
      .finally(() => {
        if (signing === going) signing = null;
      });
    signing = going;
  }

  /** Not signed: the answers to put right named, each saying its own problem, and the signature not kept. */
  function refuse(wrong: string[]) {
    mine = null;
    form.setValue(name, null);
    for (const field of wrong) form.boxLeft(field);
    const asLabel = labelAt(words.notSignedYet, 'fields', form.page.lowerLabels, locale);
    const labelsOf = wrong.map((field) => asLabel(form.page.fields[field]?.label ?? field));
    let list: string;
    try {
      list = new Intl.ListFormat(locale ?? 'en', { type: 'conjunction' }).format(labelsOf);
    } catch {
      list = labelsOf.join(', ');
    }
    say(fillIn(words.notSignedYet, { fields: list }));
  }

  /** Said under the pad, politely: why nothing was signed, or (`news`) what was done. */
  function say(text: string, news = false) {
    // Said again only when it changes: a name typed letter by letter is not refused aloud at each.
    if (text && !refused.hidden && refused.textContent === text) return;
    setText(refused, '');
    setText(refused, text);
    setAttr(refused, 'data-news', news ? '' : null);
    setHidden(refused, !text);
  }

  /** The evidence's fingerprint last made again from the answers, and whether it matched. */
  let checked: { key: string; matches: boolean | null } | null = null;

  /** Who signed and when, and whether the answers are still as signed: their fingerprint made again from them now. */
  function showEvidence(value: Value | undefined, values: Readonly<Values>) {
    const evidence = evidenceOf(value);
    setHidden(evidenceBox, !evidence);
    if (!evidence) {
      checked = null;
      return setHidden(question, true);
    }
    // Its day and time kept together on one line, wherever the words wrap.
    const [before, after = ''] = fillIn(evidence.by ? words.signedByName : words.signedAt, { name: evidence.by ?? '' }).split('{when}');
    const when = restingText(evidence.at, 'datetime', locale ?? 'en', zoneOf(form));
    if (signedWho.textContent !== before + when + after) signedWho.replaceChildren(before, make('span', { class: 'fd-signature-when' }, when), after);
    // A fingerprint in a form this Fieldia does not write is not said either way.
    const text = evidence.format === SIGNATURE_FORMAT ? signatureText({ page: form.page.id, field: name, at: evidence.at, ...(evidence.by ? { by: evidence.by } : {}), answers: signedAnswers(form.page, values, evidence.fields) }) : null;
    const key = `${evidence.sha256} ${text}`;
    if (text !== null && checked?.key !== key) {
      // Said only while the evidence and the answers are those it was made from — whatever record shows them: it
      // writes nothing on the record, so a record shown again meanwhile is told it as well.
      const asked: { key: string; matches: boolean | null } = (checked = { key, matches: null });
      void sha256Hex(text).then((hash) => {
        if (checked !== asked) return;
        asked.matches = hash === evidence.sha256;
        drawMatch();
      });
    }
    if (text === null) checked = null;
    drawMatch();
  }

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
    turn++;
    wipe();
    mine = null;
    typed.value = '';
    showPad();
    form.setValue(name, null);
    say(words.signatureTakenAway, true);
    typed.focus();
  });
  /** The pad's point under the pointer: the pad is drawn smaller or larger than its own size. */
  function at(event: PointerEvent) {
    const box = canvas.getBoundingClientRect();
    return { x: ((event.clientX - box.left) * WIDTH) / (box.width || WIDTH), y: ((event.clientY - box.top) * HEIGHT) / (box.height || HEIGHT) };
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (readonly || event.button !== 0) return;
    event.preventDefault();
    canvas.setPointerCapture?.(event.pointerId);
    last = at(event);
    strokes.push([last]);
    hint.hidden = true;
    redraw();
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!last) return;
    const next = at(event);
    line(last, next);
    strokes[strokes.length - 1].push(next);
    last = next;
  });
  const end = () => {
    if (!last) return;
    last = null;
    keep();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  // A name typed is drawn in a hand's script, in place of whatever was drawn.
  typed.addEventListener('input', () => {
    // Signing answers, what comes of the signing says its own words.
    if (!evidencing) setHidden(refused, true);
    showPad();
    strokes = [];
    typedName = typed.value.trim() || null;
    redraw();
    keep();
  });

  undo.addEventListener('click', () => {
    strokes.pop();
    redraw();
    keep();
  });

  upload?.addEventListener('click', () => file.click());
  file.addEventListener('change', () => {
    const chosen = file.files?.[0];
    file.value = '';
    if (!chosen) return;
    // A picture, as the field takes one, no larger than it allows: else the signature there was stays, and it says why.
    const own = field.type === 'binary' ? field : null;
    const problem = fileProblem({ type: 'binary', label: field.label, accept: own?.accept ?? ['image/*'], ...(own?.maxSize !== undefined ? { maxSize: own.maxSize } : {}) }, chosen, MESSAGES[locale ?? 'en'] ?? MESSAGES.en);
    say(problem ?? '');
    // Read once another record is shown: laid on no record. One that signs answers is signed as it lands.
    if (!problem)
      void readFile(chosen).then(
        whileShown(form, (value: FileValue) => {
          form.setValue(name, value);
          if (evidencing) sign(value);
        })
      );
  });

  clear.addEventListener('click', () => {
    setHidden(refused, true);
    wipe();
    mine = null;
    typed.value = '';
    showPad();
    form.setValue(name, null);
    typed.focus();
  });

  function showPad() {
    image.hidden = true;
    canvas.hidden = false;
  }

  element.append(going.element);

  return {
    element,
    focus: () => (typed.hidden ? clear : typed).focus(),
    destroy: () => unsettle?.(),
    update(state) {
      readonly = state.readonly;
      const value = state.value && typeof state.value === 'object' && !Array.isArray(state.value) ? (state.value as FileValue) : null;
      const away = document.activeElement !== typed;
      if (value && keyOf(value) !== mine) {
        // Kept before, uploaded, or set from outside: its picture, until Clear.
        const src = value.data ? `data:${value.type};base64,${value.data}` : (value.url ?? '');
        if (image.getAttribute('src') !== src) image.src = src;
        image.hidden = false;
        canvas.hidden = true;
        mine = null;
        wipe();
        if (away) typed.value = value.text ?? '';
      } else if (!value) {
        if (mine !== null || !image.hidden) {
          // Emptied from outside.
          mine = null;
          wipe();
          if (away) typed.value = '';
        }
        showPad();
      }
      hint.hidden = readonly || !blank() || !image.hidden;
      typed.hidden = readonly;
      typed.readOnly = readonly;
      // Signed, its answers change by Change answers, asked first; one not signed yet keeps its strokes to clear.
      const signedNow = !!evidenceOf(value);
      clear.hidden = readonly || signedNow || (!value && (!evidencing || blank()));
      if (readonly || !signedNow) setHidden(question, true);
      setHidden(change, readonly || !signedNow || !question.hidden);
      showEvidence(value, state.values);
      undo.hidden = readonly || !strokes.length || !image.hidden;
      if (upload) upload.hidden = readonly;
      canvas.classList.toggle('fd-signature-locked', readonly);
      going.update(readonly);
      describeState(element, state);
      typed.setAttribute('aria-invalid', String(state.invalid));
    },
  };
};
