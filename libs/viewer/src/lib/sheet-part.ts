/**
 * The sheet part (viewer-parts.ts, `sheetPart`): a record sheet's furniture — its ribbons, stat buttons, alerts, badges,
 * statusbar and the attachment beside it (sheet-furniture.ts) — and its look (sheet-styles.ts). The sheet itself is the
 * viewer's own: a sheet page waits for this part only beside its other parts, and draws its furniture in place as it
 * comes where it waits for none.
 */
export { sheetAlerts, sheetFurniture } from './sheet-furniture';
export { installSheetStyles } from './sheet-styles';
