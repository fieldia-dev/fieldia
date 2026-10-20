import { evidenceOf, fileProblem, MESSAGES, signsAnswers, type FileValue } from '@fieldia/core';
import { readFile } from './files';
import { stillShown, whileShown } from './shown';
import { goingList } from './files-going';
import { shrinkFor, shrinkPhoto } from './shrink';
import { describeState, maker, setAttr, setHidden, setText, wordsFor } from './kind-parts';
import type { WidgetFactory, WidgetState } from './widgets';
import { installFilesStyles } from './styles-files';
import { evidencePartAsksAgain, loadEvidencePart } from './widget-parts';
import type { Signing } from './signature-signing';

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
 * signer's name: who, when and the answers' fingerprint kept beside its
 * picture (`FileValue.signed`), said under it, with Change answers. That is
 * the evidence part's (signature-signing.ts), asked for by such a signature
 * alone: until it comes, the pad draws and the picture is kept, and its
 * signing waits for it — a save waits for that signing, as for one on its way.
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
  /** Whether it signs answers: who, when and their fingerprint kept with it (the evidence part's), and those answers locked while it is. */
  const evidencing = signsAnswers(node);
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
  // The signing's part that could not come (offline, a script blocked): said, with Try again where asking again can bring
  // it (`Part.asksAgain`: the one-tag script's tags); where it cannot (an app's modules), a reload is said instead.
  const retry = make('button', { type: 'button', class: 'fd-button fd-button-link' }, words.signingRetry);
  const unloadedWords = make('span');
  const retryBox = make('span', {}, ' ', retry);
  const unloaded = make('div', { class: 'fd-help fd-file-note fd-signature-unloaded', role: 'alert', hidden: '' }, unloadedWords);
  const tools = make('div', { class: 'fd-signature-tools' }, typed, undo, ...(upload ? [upload, file] : []), clear);
  const element = make(
    'div',
    { id, class: 'fd-signature', role: 'group' },
    make('div', { class: 'fd-signature-box' }, canvas, image, hint),
    ...(typeof footerWords === 'string' && footerWords ? [make('span', { class: 'fd-signature-footer' }, footerWords)] : []),
    tools,
    refused,
    unloaded
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
      form.setValue(name, null);
      if (unsigned) leftUnsigned(null);
      return;
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
    const before = evidencing && own ? evidenceOf(was) : null;
    form.setValue(name, before ? { ...picture, signed: before } : picture);
    if (evidencing) sign(picture);
  }

  // ---- signing answers (`options.signs`): its evidence is the evidence part's ----

  /** The signing on its way, which a save waits for (`settling`), and the turn of the latest: an older one lays nothing. */
  let signing: Promise<void> | null = null;
  let turn = 0;
  /** True while a signing reads what is typed itself: it does not wait for itself. */
  let reading = false;
  const unsettle = evidencing ? form.settling(() => (reading ? undefined : (signing ?? undefined)), () => signing !== null) : null;
  /** The evidence, once its part has come: its line under the signature and its signing. */
  let evidence: Signing | null = null;
  let lastState: WidgetState | null = null;
  let gone = false;
  /** The evidence part asked for: in, or — offline, its script blocked — not come, until Try again asks once more. */
  let failed = false;
  const ask = (): Promise<void> =>
    loadEvidencePart().then(
      (part) => {
        failed = false;
        if (gone || evidence) return;
        evidence = part.signingFor({ form, name, node, document, words, locale, say, letGo, takeAway, drawn: () => !blank(), signDrawn: keep });
        tools.before(evidence.element);
        refused.after(evidence.prompt);
        if (lastState) evidence.update(lastState.value, lastState.values, lastState.readonly);
      },
      () => {
        failed = true;
      }
    );
  let coming: Promise<void> | null = evidencing ? ask() : null;

  /**
   * Its part not come: never a picture kept unsigned in silence. Said under the signature, with Try again; the picture
   * to sign kept on the pad and in the field, and every save, check and step forward refusing it with the same words —
   * the form's own refusal of what does not read (`setUnread`) — until it is signed, or taken away. A signature kept
   * signed (its evidence in its value) says the part did not come too: its answers stay locked until it does. Try again
   * only where asking again can bring the part; else the words say to reload the page (hide, never a button that cannot
   * work).
   */
  let unsigned: string | null = null;
  /** Its words where the part could not come: Try again's, or a reload's where asking again cannot bring it. */
  const notSigned = () => (evidencePartAsksAgain() ? words.notSignedNoPart : words.notSignedReload);
  const valueNow = () => {
    const value = form.getState().values[name];
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as FileValue) : null;
  };
  /** The picture `key` left unsigned for want of the part (null: none), and what the field says of it. */
  function leftUnsigned(key: string | null) {
    unsigned = key;
    const kept = form.getState().unread[name];
    if (key) {
      if (kept?.message !== notSigned()) form.setUnread(name, { text: '', message: notSigned() });
    } else if (kept && (kept.message === words.notSignedNoPart || kept.message === words.notSignedReload)) form.setUnread(name, null);
    drawUnloaded();
  }
  function drawUnloaded() {
    const value = valueNow();
    const pending = !!value && unsigned !== null && keyOf(value) === unsigned && !evidenceOf(value);
    const again = evidencePartAsksAgain();
    const said = !failed ? null : pending ? notSigned() : evidenceOf(value ?? undefined) ? (again ? words.signingNoPart : words.signingNoPartReload) : null;
    // Try again in its words only where it can work; else none at all.
    if (again && retryBox.parentNode !== unloaded) unloaded.append(retryBox);
    else if (!again) retryBox.remove();
    if (unloadedWords.textContent !== (said ?? '')) setText(unloadedWords, said ?? '');
    setHidden(unloaded, !said);
  }
  retry.addEventListener('click', () => {
    setHidden(unloaded, true);
    coming = ask();
    // The picture left unsigned is signed once the part has come; else it is said again.
    void coming.then(() => {
      const value = valueNow();
      if (value && keyOf(value) === unsigned && !evidenceOf(value)) sign(value);
      else drawUnloaded();
    });
  });

  /**
   * The answers signed with this picture, by the evidence part — once it has come — once what is typed in them is read.
   * Laid only while the record is the one shown, the picture still the field's, and this the latest signing.
   */
  function sign(picture: FileValue) {
    const ours = ++turn;
    const shown = stillShown(form);
    const current = () => ours === turn && shown() && keyOf((form.getState().values[name] ?? {}) as FileValue) === picture.data;
    const settle = () => {
      reading = true;
      try {
        return form.settle();
      } finally {
        reading = false;
      }
    };
    const run: Promise<void> = (coming ?? Promise.resolve())
      .then(() => {
        if (!current()) return undefined;
        if (!evidence) return leftUnsigned(keyOf(picture));
        leftUnsigned(null);
        return evidence.sign(picture, { settle, current });
      })
      .catch(() => undefined)
      .finally(() => {
        if (signing === run) signing = null;
      });
    signing = run;
  }

  /** Not signed: the picture is the field's no longer; what was drawn stays on the pad, to clear or add to. */
  function letGo() {
    mine = null;
    form.setValue(name, null);
    if (unsigned) leftUnsigned(null);
  }

  /** Taken away by Change answers: the answers it signed open, to change and sign again. */
  function takeAway() {
    turn++;
    wipe();
    mine = null;
    typed.value = '';
    showPad();
    form.setValue(name, null);
    if (unsigned) leftUnsigned(null);
    typed.focus();
  }

  /** Said under the pad, politely: why nothing was taken or signed, or (`news`) what was done. */
  function say(text: string, news = false) {
    // Said again only when it changes: a name typed letter by letter is not refused aloud at each.
    if (text && !refused.hidden && refused.textContent === text) return;
    setText(refused, '');
    setText(refused, text);
    setAttr(refused, 'data-news', news ? '' : null);
    setHidden(refused, !text);
  }

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
    if (unsigned) leftUnsigned(null);
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
    destroy() {
      gone = true;
      unsettle?.();
    },
    update(state) {
      lastState = state;
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
      // Signed, its answers change by Change answers (the evidence part's), asked first; one not signed yet keeps its
      // strokes to clear.
      clear.hidden = readonly || (evidencing && !!evidenceOf(value)) || (!value && (!evidencing || blank()));
      evidence?.update(value, state.values, readonly);
      if (evidencing) drawUnloaded();
      undo.hidden = readonly || !strokes.length || !image.hidden;
      if (upload) upload.hidden = readonly;
      canvas.classList.toggle('fd-signature-locked', readonly);
      going.update(readonly);
      describeState(element, state);
      typed.setAttribute('aria-invalid', String(state.invalid));
    },
  };
};
