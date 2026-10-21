/**
 * The element part (element.ts, `elementPart`): what `<fieldia-form>` does once it is on a page — its page fetched and
 * its form drawn in it, its events told, answers sent to its `action`, and in an iframe its height told to the page
 * round it (element-form.ts). Loaded the first time a `<fieldia-form>` is put on a page.
 */
export { actionSource, changed, connect, disconnect, handleOf } from './element-form';
