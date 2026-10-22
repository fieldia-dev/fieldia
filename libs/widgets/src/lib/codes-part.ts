/**
 * The codes part (parts.ts): a field's value shown as a code on the screen — a QR code (`"widget": "qrcode"`) or a
 * Code 128 barcode (`"widget": "barcode"`) — drawn as SVG by Fieldia's own encoders (qr.ts, code128.ts), and its sheet
 * (styles-codes.ts). Loaded the first time a page shows a code; the field's box meanwhile.
 */
export { codeWidget } from './codes';
export { qrCode, qrVersion, QrTooLong, type QrCode, type QrLevel } from './qr';
export { code128, code128Values, Code128Refused } from './code128';
export { installCodesStyles } from './styles-codes';
