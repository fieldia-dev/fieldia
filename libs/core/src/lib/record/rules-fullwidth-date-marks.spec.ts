import { readNumber, readDate, readTime } from './input-rules';

/**
 * A Japanese or Chinese keyboard in full width writes a date and a time with its own marks: "１５／１０／２０２６",
 * "１４：３０". The readers take its digits (１５/１０/２０２６ reads) and a number's own full-width marks ("１２，５"
 * is 12.5), but not a date's slash or a time's colon in full width: such a date is "not a whole date yet", such a
 * time "not a time" — a right way to write them refused, unlike the number beside them.
 */
describe('a date and a time written in full width, as a number already is', () => {
  it('reads a number with a full-width decimal mark (as it does today)', () => {
    expect(readNumber('１２，５', 'en')).toMatchObject({ ok: true, value: 12.5 });
  });

  it('reads a date and time with its marks in ASCII (as it does today)', () => {
    expect(readDate('１５/１０/２０２６ １４:３０', { order: 'dmy', time: true })).toMatchObject({ ok: true, value: '2026-10-15T14:30' });
  });

  it('reads a date with full-width slashes', () => {
    expect(readDate('１５／１０／２０２６', { order: 'dmy' })).toMatchObject({ ok: true, value: '2026-10-15' });
  });

  it('reads a time with a full-width colon', () => {
    expect(readTime('１４：３０')).toMatchObject({ ok: true, value: '14:30' });
  });

  it('reads a date and time with full-width marks', () => {
    expect(readDate('１５／１０／２０２６ １４：３０', { order: 'dmy', time: true })).toMatchObject({ ok: true, value: '2026-10-15T14:30' });
  });
});
