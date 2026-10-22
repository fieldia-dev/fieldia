/**
 * The typed part (parts.ts): boxes that read a value typed to a shape — a text box typed to a mask (a national ID, an
 * IBAN, a car plate: mask-box.ts, its pattern read and laid out by mask.ts), and a one-time code's boxes (code-box.ts),
 * with their sheet (styles-typed.ts), and amounts typed in shorthand (shorthand.ts: "3.5m", "500k", "٣٫٥ مليون"). Loaded
 * the first time a page shows a char field with `options.mask`, one with `"widget": "one-time-code"`, or a number or an
 * amount with `options.shorthand`, through `typedPart`; the plain box meanwhile. Whether a field needs it stays in the
 * main script (`hasMask`, `amounts`, widgets.ts), and so does the number box that reads with it (`readShort`).
 */
export { maskWidget, maskOf } from './mask-box';
export { readMask, conform, masked, maskShape, type Mask } from './mask';
export { codeWidget, codeLength } from './code-box';
export { installTypedStyles } from './styles-typed';
export { shorthandFor } from './shorthand';
