/**
 * The typed part (parts.ts): boxes that read a value typed to a shape — a text box typed to a mask (a national ID, an
 * IBAN, a car plate: mask-box.ts, its pattern read and laid out by mask.ts), and a one-time code's boxes (code-box.ts),
 * with their sheet (styles-typed.ts). Loaded the first time a page shows a char field with `options.mask`, or one with
 * `"widget": "one-time-code"`, through `typedPart`; the text box it was meanwhile. Whether a field has a mask stays in
 * the main script (`hasMask`, widgets.ts).
 */
export { maskWidget, maskOf } from './mask-box';
export { readMask, conform, masked, maskShape, type Mask } from './mask';
export { codeWidget, codeLength } from './code-box';
export { installTypedStyles } from './styles-typed';
