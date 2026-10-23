import { installPartStyles, installStyles, PART_RANK } from './styles';

/**
 * The parts' sheets in one order (PART_RANK, 0.31): each rank once; every part that draws its own parts — 0.29's four
 * and Wave 6's nine — after the limits' and before the themes', which reshape them; the quiet look, the pickers', the
 * head's, the text's, the survey kinds' looks, the cards', a code scanned's and a wait's spinners after the themes.
 */
describe('the parts’ sheets in one order', () => {
  it('gives each part a rank of its own, the nine of 0.31 between 0.29’s four and the themes', () => {
    const ranks = Object.values(PART_RANK);
    expect(new Set(ranks).size).toBe(ranks.length);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks.map((_, i) => i));
    const before = ['approvals', 'assist', 'photos', 'languages', 'months', 'typed', 'record', 'codes', 'pins', 'verify', 'pay', 'outbox', 'schedule'] as const;
    expect(before.map((name) => PART_RANK[name])).toEqual(before.map((_, i) => PART_RANK.limits + 1 + i));
    expect(PART_RANK.themes).toBe(PART_RANK.schedule + 1);
    const after = ['quiet', 'picker', 'head', 'groups', 'text', 'surveyLooks', 'cards', 'scan', 'loading'] as const;
    expect(after.map((name) => PART_RANK[name])).toEqual(after.map((_, i) => PART_RANK.themes + 1 + i));
  });

  it('puts a sheet of 0.31 after the languages’ and before the themes’, whichever came first', () => {
    document.head.replaceChildren();
    installStyles(document);
    installPartStyles(document, 'fieldia-theme-styles', '.t{}', PART_RANK.themes);
    installPartStyles(document, 'fieldia-languages-styles', '.l{}', PART_RANK.languages);
    installPartStyles(document, 'fieldia-schedule-styles', '.s{}', PART_RANK.schedule);
    installPartStyles(document, 'fieldia-months-styles', '.m{}', PART_RANK.months);
    const ids = [...document.head.querySelectorAll('style[data-fd-rank]')].map((style) => style.id);
    expect(ids).toEqual(['fieldia-languages-styles', 'fieldia-months-styles', 'fieldia-schedule-styles', 'fieldia-theme-styles']);
  });
});
