import type { Statusbar } from './layout';
import type { EndingTools } from './part-checks';

/**
 * A sheet's statusbar (`statusbar`): a choice's or a link's steps, its time per step from a json field, the steps it
 * shows of a choice, a click that saves where a step can be clicked. Drawn by the business part, which carries these
 * in the one-tag script, run once it came (later-checks.ts); the packages' checks run them at once.
 */
export function checkStatusbar(statusbar: Statusbar, path: string, tools: Pick<EndingTools, 'need' | 'report' | 'checkModifiers' | 'owe' | 'page'>): void {
  const { field, visibleStates, durationsField, fold, saves, clickable } = statusbar;
  const at = `${path}.statusbar`;
  tools.checkModifiers(statusbar, at);
  if (durationsField !== undefined) {
    const times = tools.need(durationsField, `${at}.durationsField`);
    if (times && times.type !== 'json') tools.report(`${at}.durationsField`, `"${durationsField}" is a ${times.type}; time per step comes from a json field`);
  }
  if (saves && !clickable) tools.report(`${at}.saves`, 'a click saves only where a step can be clicked (clickable)');
  const def = tools.need(field, `${path}.statusbar.field`);
  if (fold && def && def.type !== 'many2one') tools.report(`${at}.fold`, 'steps fold by their record (a stage), so only a link’s steps fold; a choice keeps the steps it shows with visibleStates');
  if (def && def.type !== 'selection' && def.type !== 'many2one') {
    tools.report(`${path}.statusbar.field`, `"${field}" is a ${def.type}; a statusbar needs a selection or many2one`);
  }
  if (def?.type === 'selection' && visibleStates) {
    const values = new Set(def.options.map((o) => o.value));
    visibleStates.forEach((state, i) => {
      if (!values.has(state)) {
        tools.report(`${path}.statusbar.visibleStates[${i}]`, `"${state}" is not an option of "${field}"`);
      }
    });
  }
}
