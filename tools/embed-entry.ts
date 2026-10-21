/**
 * fieldia-embed.js: a form from the app's own site placed on another with one script tag, in an iframe that grows and
 * shrinks with the form (libs/viewer/src/lib/embed-frame.ts). Nothing else of Fieldia's comes with it: the form's own page
 * loads fieldia.js inside the frame.
 */
import { embedHere } from '../libs/viewer/src/lib/embed-frame';

if (typeof document !== 'undefined') embedHere(document);
