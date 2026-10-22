/**
 * The views part (parts.ts in @fieldia/widgets): a list's views kept on the app's server — the search bar's menu's
 * favourites drawn from them, saved, shared and deleted there, and the one the list opens on (saved-views.ts) — and their
 * sheet (views-styles.ts), put in after the list's own. Loaded the first time a list's data source keeps views
 * (`views`), through `viewsPart`, as the list asks for them before its records; where it could not come, the list keeps
 * its favourites in the browser, as it does for a source without views.
 */
export { openingView, savedViews } from './saved-views';
export type { SavedViews, SavedViewsContext, ViewsSource } from './saved-views';
export { installViewStyles } from './views-styles';
