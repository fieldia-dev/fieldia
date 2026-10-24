import { readDate } from '@fieldia/core';
import { readDateText } from './date-text';
import { hasLinks, linkedWords } from './linked-words';
import { markdownToHtml } from './markdown';

/**
 * Long text a person types or pastes is read at once by Fieldia's own readers — a date's, Markdown's links, words with
 * links — never by patterns that try every start to the text's end (S-L6: the audit's proofs took seconds on 20,000 to
 * 80,000 characters). Each finishes in under 50 ms.
 */
const timed = (run: () => unknown) => {
  const start = performance.now();
  run();
  return performance.now() - start;
};
const N = 40000;

describe('long text read at once (S-L6)', () => {
  it('reads no date from text longer than a date is written, said as unfinished (the audit’s proof: 8.5 s)', () => {
    const reader = { kind: 'datetime' as const, order: 'dmy' as const, locale: 'en' as const, label: 'When' };
    for (const text of ['1:11' + ' '.repeat(N) + 'x', '1 1:11 a' + ' '.repeat(N) + 'xx', '1:11' + '\t'.repeat(N / 2) + 'UTC' + ' '.repeat(N / 2) + 'x']) {
      for (const kind of ['datetime', 'date', 'time'] as const) {
        let read: ReturnType<typeof readDateText> | undefined;
        expect(timed(() => (read = readDateText(text, { ...reader, kind })))).toBeLessThan(50);
        expect(read?.ok).toBe(false);
      }
      expect(timed(() => readDate(text, { time: true }))).toBeLessThan(50);
    }
    // A date as people write it, as ever.
    expect(readDateText('30 September 2026 14:30', reader)).toMatchObject({ ok: true });
  });

  it('reads Markdown’s pictures and links once through (the audit’s proofs: 0.3 to 0.4 s on 20,000 characters)', () => {
    for (const unit of ['[a', '![a', '[a](', '[a](http://', '[']) expect(timed(() => markdownToHtml(unit.repeat(N / unit.length)))).toBeLessThan(50);
    expect(markdownToHtml('See [the plan](https://ok.example/plan) and ![a map](https://ok.example/map.png)')).toBe('<p>See <a href="https://ok.example/plan">the plan</a> and <img src="https://ok.example/map.png" alt="a map"></p>');
  });

  it('finds words with links once through (the audit’s proof: 7.6 s on 80,000 characters)', () => {
    expect(timed(() => hasLinks('['.repeat(2 * N)))).toBeLessThan(50);
    expect(timed(() => hasLinks('[a](http://'.repeat(N / 11)))).toBeLessThan(50);
    expect(hasLinks('Read [the terms](https://ok.example/terms).')).toBe(true);
    expect(linkedWords(document, 'Read [the terms](https://ok.example/terms).').map((node) => (node as Element).outerHTML ?? node.textContent)).toEqual(['Read ', '<a href="https://ok.example/terms" target="_blank" rel="noopener noreferrer">the terms</a>', '.']);
  });
});
