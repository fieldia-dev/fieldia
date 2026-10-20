/**
 * Code a page loads the first time it uses it: the parts' loader is @fieldia/core's (lib/parts.ts), whose own parts —
 * a form's code only some pages need — come the same way. The widgets' parts and the viewer's are made with it.
 */
export { lazyPart, partWith, partsOf, partsComeByScriptTag, settleParts, type Part } from '@fieldia/core';
