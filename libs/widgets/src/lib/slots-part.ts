/**
 * The slots part (parts.ts): booking slots (slots.ts) — a month shaded by how
 * its days are booked, the day's free times to pick from, a time taken
 * meanwhile said — with their stylesheet (styles-slots.ts). Loaded the first
 * time a page shows a date and time drawn as slots, through `slotsPart`, with
 * the date part beside it: the date and time box it is where the data source
 * has no `slots`. A plain date and time box meanwhile (`plainDateWidget`).
 */
export { slotsWidget } from './slots';
