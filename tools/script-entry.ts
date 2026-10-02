/**
 * What the `<script>` bundle puts on `window.Fieldia`: everything a page with
 * no build step needs to show a form and handle what people enter.
 */
export * from '@fieldia/core';
export * from '@fieldia/widgets';
export * from '@fieldia/viewer';

declare const __FIELDIA_VERSION__: string;
/** The version of @fieldia/viewer this bundle was built from. */
export const VERSION: string = __FIELDIA_VERSION__;
