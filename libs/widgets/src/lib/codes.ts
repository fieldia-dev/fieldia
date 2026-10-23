import type { CodeOptions } from '@fieldia/core';
import { code128, Code128Refused } from './code128';
import { fillIn, maker, setHidden, setText, wordsFor } from './kind-parts';
import { qrCode, QrTooLong, type QrLevel } from './qr';
import { installCodesStyles } from './styles-codes';
import type { Widget, WidgetContext, WidgetFactory } from './widgets';

/**
 * A field's value shown as a code on the screen, to be scanned — a ticket's QR, "open on your phone", an asset's label:
 * `"widget": "qrcode"` (a char or text field) draws a QR code, `"widget": "barcode"` (a char or integer field) a Code
 * 128 barcode. The code follows the value as it changes; one that cannot be drawn — words too long for a QR code, a
 * character Code 128 cannot write — says why in its place. Read-only, the value's words are under the code where
 * `showValue` says (a barcode's always, unless it says false); editable, the field's own box is over it, the code
 * drawn from what is typed once it is read.
 *
 * Drawn as SVG, black on white whatever the page's scheme — a scanner needs it — crisp at any size and on paper, named
 * for a screen reader as what it is and what it holds. Options (the format's `CodeOptions`):
 *
 *   level      a QR code's error correction: "L", "M" (the default), "Q" or "H"
 *   size       a QR code's side, or a barcode's height, in pixels: 160 and 64 unless it says
 *   showValue  the value's words under the code: a barcode's unless false, a QR code's where true — a short line
 *              as it is, a longer payload's summary or nothing (`codeSummary`)
 *
 * The encoders are Fieldia's own (qr.ts, code128.ts), in the codes part with this widget (codes-part.ts), loaded the
 * first time a page shows a code; the field's box meanwhile.
 */

/** A short line: what is said of a code's value as it is. */
const SHORT = 60;

/**
 * What is said of a QR code's value under it and to a screen reader: a short line as it is; else its summary — a link
 * with parameters by its address
 * (host and path), a contact card (vCard, MECARD) by its name, a network's details (WIFI:) by its name, an email or a
 * phone link by its address — or nothing, the code alone. Its value stays whole in the code. A barcode's value is an
 * identifier, said as it is: never a number grouped, in its box at rest too.
 */
export function codeSummary(value: string): string {
  const text = value.trim();
  const named = (pattern: RegExp) => pattern.exec(text)?.[1]?.replace(/\\([,;:\\])/g, '$1').trim() ?? '';
  if (/^BEGIN:VCARD/i.test(text)) return named(/^FN[;:][^\r\n]*?:?([^:\r\n]+)$/im) || named(/^ORG[;:]([^\r\n;]+)/im);
  if (/^MECARD:/i.test(text)) return named(/[:;]N:([^;]+)/i);
  if (/^WIFI:/i.test(text)) return named(/[:;]S:((?:\\.|[^;])+)/i);
  if (/^(mailto|tel|sms):/i.test(text)) return text.replace(/^[a-z]+:/i, '').split('?')[0];
  if (/^https?:\/\//i.test(text) && (/[?#]/.test(text) || text.length > SHORT)) {
    try {
      const url = new URL(text);
      const at = `${url.host}${url.pathname.replace(/\/$/, '')}`;
      return at.length > SHORT ? url.host : at;
    } catch {
      return '';
    }
  }
  return text.length > SHORT || /[\r\n]/.test(text) ? '' : text;
}

/** A code drawn: its SVG, named, or why it cannot be. */
function drawCode(doc: Document, kind: 'qr' | 'bar', value: string, options: CodeOptions): { svg: SVGSVGElement } | { refused: unknown } {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = doc.createElementNS(ns, 'svg');
  const path = doc.createElementNS(ns, 'path');
  let d = '';
  let width: number;
  let height: number;
  try {
    if (kind === 'qr') {
      const code = qrCode(value, (options.level as QrLevel | undefined) ?? 'M');
      // A light margin of four modules round it, as a scanner needs; each row's dark runs as one rectangle.
      width = height = code.size + 8;
      code.modules.forEach((row, y) => {
        for (let x = 0; x < code.size; x++) {
          if (!row[x]) continue;
          let end = x;
          while (end < code.size && row[end]) end++;
          d += `M${x + 4} ${y + 4}h${end - x}v1h${x - end}z`;
          x = end;
        }
      });
    } else {
      // Ten modules of light either side; the bars full height.
      const bars = code128(value);
      width = bars.reduce((sum, bar) => sum + bar, 0) + 20;
      height = 1;
      let x = 10;
      bars.forEach((bar, i) => {
        if (i % 2 === 0) d += `M${x} 0h${bar}v1h${-bar}z`;
        x += bar;
      });
    }
  } catch (refused) {
    return { refused };
  }
  const side = options.size ?? (kind === 'qr' ? 160 : 64);
  for (const [name, value] of Object.entries({
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: 'none',
    'shape-rendering': 'crispEdges',
    role: 'img',
    // A barcode is as wide as its modules, two pixels each at least; a QR code square.
    width: String(kind === 'qr' ? side : Math.max(width * 2, side)),
    height: String(side),
  }))
    svg.setAttribute(name, value);
  path.setAttribute('d', d);
  svg.append(path);
  return { svg };
}

export const codeWidget =
  (widgetFor: (context: WidgetContext) => Widget): WidgetFactory =>
  (context) => {
    const { node, document: doc, labels, locale } = context;
    installCodesStyles(doc);
    const words = wordsFor(labels, locale);
    const make = maker(doc);
    const kind = node.widget === 'barcode' ? 'bar' : 'qr';
    const options = (node.options ?? {}) as CodeOptions;
    const showValue = options.showValue ?? kind === 'bar';
    // The field's own box, over the code, while it may be typed in: its value an identifier, a number never grouped.
    const box = widgetFor({ ...context, node: { ...node, widget: undefined, options: { ...node.options, grouping: false } } });
    const picture = make('div', { class: 'fd-code-picture' });
    const words_ = make('span', { class: 'fd-code-words', dir: 'auto' });
    const why = make('p', { class: 'fd-help fd-code-why', role: 'status' });
    const figure = make('figure', { class: 'fd-code-figure', hidden: '' }, picture, words_);
    const element = make('div', { class: `fd-code fd-code-${kind}` }, box.element, figure, why);
    let drawn: string | null = null;
    return {
      element,
      focus: () => box.focus(),
      update(state) {
        box.update(state);
        setHidden(box.element, state.readonly);
        const value = state.value === null || state.value === undefined ? '' : String(state.value);
        if (value === drawn) return;
        drawn = value;
        const made = value ? drawCode(doc, kind, value, options) : null;
        // A barcode's value is an identifier, as it is; a QR code's payload said by its summary.
        const said = kind === 'qr' ? codeSummary(value) : value;
        if (made && 'svg' in made) {
          made.svg.setAttribute('aria-label', said ? fillIn(kind === 'qr' ? words.qrCodeOf : words.barcodeOf, { value: said }) : words.qrCode);
          picture.replaceChildren(made.svg);
          setText(why, '');
        } else {
          picture.replaceChildren();
          const refused = made && 'refused' in made ? made.refused : null;
          setText(why, refused instanceof QrTooLong ? words.qrTooLong : refused instanceof Code128Refused ? fillIn(words.barcodeRefused, { character: refused.character }) : '');
        }
        setText(words_, said);
        setHidden(words_, !showValue || !said);
        setHidden(figure, !(made && 'svg' in made));
      },
      destroy: () => box.destroy?.(),
    };
  };
