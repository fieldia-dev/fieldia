/**
 * The pins part (parts.ts): pins with notes on a picture (`"widget": "pins"` on a json field) — a face chart, a floor
 * plan, a car's damage — placed by a click, a tap or the keyboard, dragged, read to a screen reader as a numbered list
 * (pins.ts), and its sheet (styles-pins.ts). Loaded the first time a page shows pins; their notes meanwhile.
 */
export { pinsWidget, pinsOf, pinAt, type Pin } from './pins';
export { installPinsStyles } from './styles-pins';
