/**
 * The phone part (parts.ts): a phone number read the world over — its box with its country picked or typed, checked
 * by its country, kept as E.164 and shown at rest with a call and a WhatsApp link (phone-box.ts) — and every country's
 * numbers, read and written by a table made from libphonenumber's metadata (phone-numbers.ts, phone-table.ts), with its
 * sheet (styles-phone.ts). Loaded the first time a page shows a phone field its page's `phone` or its own options read
 * so, or a list writes such a number, through `phonePart`; the text box it was meanwhile. Whether a field reads so
 * stays in the main script (phone-settings.ts), and so do the box's input rules (text-box.ts).
 */
export { phoneWidget } from './phone-box';
export { readPhone, writePhone, shownPhone, phoneLinks, phoneParts, phoneCountries, phoneCountry, flagOf } from './phone-numbers';
export type { PhoneCountry, PhoneProblem, PhoneReading } from './phone-numbers';
