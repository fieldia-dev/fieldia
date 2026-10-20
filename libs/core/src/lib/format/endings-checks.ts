import type { Page } from './page';
import type { EndingTools } from './part-checks';

/**
 * What a page of responses shows once it is sent (that it is one, the reference check says): each ending's condition
 * reads the answers (and `id`, the response's),
 * its words name fields of the page (or `id`), it says something, and none follows one that is always shown.
 */
export function checkEndings(page: Page, tools: EndingTools): void {
  let always = '';
  (Array.isArray(page.endings) ? page.endings : []).forEach((ending, i) => {
    const at = `endings[${i}]`;
    if (always) tools.report(at, `never shown: ${always} has no when and comes first`);
    tools.checkModifiers(ending, at, ['when']);
    if (ending.when === undefined || ending.when === true) always ||= at;
    if (typeof ending.title !== 'string' && typeof ending.text !== 'string') tools.report(at, 'an ending needs a title or text');
    tools.checkWords(ending, at, ['title', 'text'], true);
  });
}
