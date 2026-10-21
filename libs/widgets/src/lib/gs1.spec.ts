import { gs1Day, gs1Number, isGs1Day, readGs1 } from './gs1';

/**
 * A GS1 code's parts, as scanners give them: after a symbology identifier or an FNC1 (a group separator), each part by
 * its identifier — a fixed length's, or one ended by a group separator or the code's end — or as a label prints them
 * in brackets; a code that is no GS1 code is none.
 */
describe("a GS1 code's parts", () => {
  const GS = '\u001d';

  it("reads a medicine's DataMatrix as a reader gives it: an FNC1 first, a group separator after a part of no fixed length", () => {
    expect(readGs1(`${GS}0106285096000842172812311025A1234${GS}21SN998877`)).toEqual({ '01': '06285096000842', '17': '281231', '10': '25A1234', '21': 'SN998877' });
  });

  it('reads it after a symbology identifier, and written in brackets as a label prints it', () => {
    expect(readGs1(']d20106285096000842172812311025A1234')).toEqual({ '01': '06285096000842', '17': '281231', '10': '25A1234' });
    expect(readGs1(']C1010628509600084210LOT7')).toEqual({ '01': '06285096000842', '10': 'LOT7' });
    expect(readGs1('(01)06285096000842 (17)281231 (10)25A1234')).toEqual({ '01': '06285096000842', '17': '281231', '10': '25A1234' });
  });

  it('reads a code with no marker where it starts as a GS1 code does', () => {
    expect(readGs1('0106285096000842172812311025A1234')).toEqual({ '01': '06285096000842', '17': '281231', '10': '25A1234' });
  });

  it('reads three- and four-digit identifiers: a weight with its places, a count, a price', () => {
    expect(readGs1(`${GS}01062850960008423103001250${GS}37${'24'}`)).toEqual({ '01': '06285096000842', '3103': '001250', '37': '24' });
  });

  it('is none for a code that is no GS1 code: a plain EAN-13, a web address, words, a part cut short', () => {
    expect(readGs1('6224000123451')).toBeNull();
    expect(readGs1('https://fieldia.dev')).toBeNull();
    expect(readGs1('P-1042')).toBeNull();
    expect(readGs1(`${GS}0106285096`)).toBeNull();
    expect(readGs1('(01)0628 and more')).toBeNull();
  });

  it("writes a part's day as the date it names, the month's last day for 00, in the century round today", () => {
    const now = new Date('2026-10-20T00:00:00Z');
    expect(gs1Day('281231', now)).toBe('2028-12-31');
    expect(gs1Day('270200', now)).toBe('2027-02-28');
    expect(gs1Day('280200', now)).toBe('2028-02-29');
    expect(gs1Day('990101', now)).toBe('1999-01-01');
    expect(gs1Day('281331', now)).toBeNull();
    expect(gs1Day('280230', now)).toBeNull();
    expect(isGs1Day('17')).toBe(true);
    expect(isGs1Day('10')).toBe(false);
  });

  it("reads a part's number: a measure with its places, an amount after its currency, a count as it is", () => {
    expect(gs1Number('3103', '001250')).toBe(1.25);
    expect(gs1Number('3922', '1999')).toBe(19.99);
    expect(gs1Number('3932', '8181999')).toBe(19.99);
    expect(gs1Number('37', '24')).toBe(24);
    expect(gs1Number('10', '25A1234')).toBeNull();
  });
});
