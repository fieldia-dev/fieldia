/**
 * The quiet look's part (parts.ts): its sheet (styles-quiet.ts), every value
 * plain words until pointed at or entered. Loaded the first time a page wears
 * the look — its skin, or a group or a field that asks — through `quietPart`:
 * the viewer waits for it before it draws a page that names it, and a quiet
 * skin the app gives or switches to is drawn boxed until it comes, every value
 * shown (`wearQuiet`, look-parts.ts). Which widgets wear the look, and how a
 * date opens in it, stay in the main script (quiet.ts).
 */
export { installQuietStyles } from './styles-quiet';
