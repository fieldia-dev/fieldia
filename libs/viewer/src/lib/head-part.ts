/**
 * The head part (parts.ts in @fieldia/widgets): what a work item's record draws
 * beyond any page's — its head (record-head.ts) with the tabs placed in it,
 * buttons split, toggled or shown by their icon alone (rich-button.ts), the
 * menus inside a menu (menu-flyout.ts), a
 * group's heading with its tools (section-tools.ts), the inset dialog's ⤢ and
 * grip (dialog-window.ts) — and their stylesheets, which each puts in the page
 * as it is first drawn. Loaded the first time a page draws one, through
 * `headPart`; the viewer waits for it before it draws such a page.
 */
export { recordHead } from './record-head';
export { richButton } from './rich-button';
export { submenus } from './menu-flyout';
export { sectionHeading } from './section-tools';
export { wireGrip, wireMaximise } from './dialog-window';
export { installGroupStyles } from './group-styles';
export { installHeadStyles } from './head-styles';
