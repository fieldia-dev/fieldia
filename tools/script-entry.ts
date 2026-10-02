/**
 * What the `<script>` bundle puts on `window.Fieldia`: everything a page with
 * no build step needs to show a form and handle what people enter.
 */
// The runtime alone: the format's schemas and validation library stay out of a page with no build step.
export * from '../libs/core/src/runtime';
export * from '@fieldia/widgets';
export * from '@fieldia/viewer';

declare const __FIELDIA_VERSION__: string;
/** The version of @fieldia/viewer this bundle was built from. */
export const VERSION: string = __FIELDIA_VERSION__;
