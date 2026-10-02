/** The grid's own touches on top of AG Grid's theme, scoped to Fieldia grids. */
export const GRID_CSS = /* css */ `
.fd-grid-lines { display: grid; grid-template-columns: minmax(0, 1fr); gap: 6px; min-width: 0; }
.fd-grid-host { min-width: 0; }
/* AG Grid keeps 150px of rows for its "no rows" message; ours has none, so one row's height is enough. */
.fd-grid-lines .ag-grid-scrolling-rows.ag-layout-auto-height { min-height: 40px; }
/* AG Grid keeps room for a sideways scroll bar it has marked invisible; give the room back until it is needed. */
.fd-grid-lines .ag-body-horizontal-scroll.ag-invisible { display: none; }
.fd-grid-lines .fd-grid-tools { padding: 0; display: flex; align-items: center; justify-content: center; }
.fd-grid-lines .ag-cell .fd-checkbox { margin: 0; vertical-align: middle; }
/* The editor fills its cell, so the text sits where the shown value sat. */
.fd-grid-editor { height: 100%; display: flex; align-items: center; }
.fd-grid-editor > * { flex: 1; min-width: 0; }
.fd-grid-editor .fd-input { border: 0; box-shadow: none; background: transparent; padding-inline: 0; min-height: 0; }
.fd-grid-editor[data-type="integer"] input, .fd-grid-editor[data-type="float"] input, .fd-grid-editor[data-type="monetary"] input { text-align: end; }
`;

const STYLE_ID = 'fieldia-grid-styles';

export function installGridStyles(document: Document): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = GRID_CSS;
  (document.head ?? document.documentElement).append(style);
}
