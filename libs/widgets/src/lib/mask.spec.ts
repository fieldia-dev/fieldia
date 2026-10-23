import { caretAfter, conform, masked, maskShape, readMask, valueIn } from './mask';

/**
 * A mask's pattern read, and text laid out against it as it is typed: the mask's own characters written in, a
 * character typed where a slot takes it kept (a digit as 0-9, a letter in capitals where it says), the mask's own
 * typed where it stands passed over, a space or a dash between groups let go, and anything else refused where it
 * stands, with what its place wants.
 */

const IBAN = readMask('aa99 **** **** **** **** **[** **** **** **]', true)!;
const ID = readMask('9 999999 99 99999')!;
const PLATE = readMask('9999 aaa', true)!;
const SAUDI = readMask('SA99 9999 9999 9999 9999 9999')!;

describe('a mask', () => {
  it('reads its pattern: the slots it needs, those it may leave out, its own characters', () => {
    expect(ID.needed).toBe(14);
    expect(ID.most).toBe(14);
    expect(IBAN.needed).toBe(22);
    expect(IBAN.most).toBe(34);
    expect(maskShape(ID)).toBe('_ ______ __ _____');
    expect(readMask('---')).toBeNull();
    expect(readMask('\\9 99')!.parts[0]).toEqual({ own: '9', optional: false });
  });

  it('writes its own characters in as the slots fill, and those after the last when open', () => {
    expect(conform('2901011', ID)).toEqual({ ok: true, shown: '2 901011', typed: '2901011', filled: 7 });
    expect(conform('2901011', ID, true)).toMatchObject({ shown: '2 901011 ' });
    expect(conform('2 901011 23 45678', ID)).toMatchObject({ ok: true, typed: '29010112345678', filled: 14 });
    // Digits in any script, kept as 0-9; a dash or a space typed between groups let go.
    expect(conform('٢٩٠-١٠١١', ID)).toMatchObject({ ok: true, typed: '2901011' });
  });

  it('refuses a character no slot takes there, saying what its place wants', () => {
    expect(conform('29o', ID)).toEqual({ ok: false, at: 2, char: 'o', want: 'digit' });
    expect(conform('1234a', PLATE)).toMatchObject({ ok: true, shown: '1234 A' });
    expect(conform('12a', PLATE)).toEqual({ ok: false, at: 2, char: 'a', want: 'digit' });
    expect(conform('29010112345678 9', ID)).toEqual({ ok: false, at: 15, char: '9', want: 'room' });
  });

  it('writes letters in capitals where it says, and passes over its own letters typed as they stand', () => {
    expect(conform('eg380019', IBAN)).toMatchObject({ ok: true, shown: 'EG38 0019', typed: 'EG380019' });
    expect(conform('1234 abc', PLATE)).toMatchObject({ ok: true, shown: '1234 ABC' });
    expect(conform('sa12', SAUDI)).toMatchObject({ ok: true, shown: 'SA12', typed: '12' });
    expect(conform('12', SAUDI)).toMatchObject({ ok: true, shown: 'SA12', typed: '12' });
  });

  it('shows a value it fits laid out, and leaves one it does not as it came', () => {
    expect(masked('EG380019000500000000263180002', IBAN)).toBe('EG38 0019 0005 0000 0000 2631 8000 2');
    expect(masked('2901', ID)).toBeNull();
    expect(masked('not an id', ID)).toBeNull();
  });

  it('puts the caret before the slot after the characters typed', () => {
    expect(caretAfter('2 901011', ID, 1)).toBe(2);
    expect(caretAfter('2 901011', ID, 7)).toBe(8);
    expect(caretAfter('SA12', SAUDI, 0)).toBe(2);
  });

  it('writes its own characters after the last slot once every slot is filled', () => {
    const share = readMask('99 %')!;
    expect(conform('12', share)).toMatchObject({ shown: '12 %', typed: '12' });
    expect(conform('1', share, true)).toMatchObject({ shown: '1' });
  });

  it('finds the one value in pasted words round it, the longest that fills it; none where none does or two differ', () => {
    const NATIONAL = readMask('9 999 999 999')!;
    expect(valueIn('ID 1023456789', NATIONAL)).toMatchObject({ shown: '1 023 456 789', typed: '1023456789' });
    expect(valueIn('IBAN: SA03 8000 0000 6080 1016 7519.', IBAN)).toMatchObject({ typed: 'SA0380000000608010167519' });
    expect(valueIn('Plate: 4821 rka (the white car)', PLATE)).toMatchObject({ shown: '4821 RKA' });
    // None that fills it: the letters before the digits, or one digit too many.
    expect(valueIn('RKA 4821', PLATE)).toBeNull();
    expect(valueIn('ID 1023-456-7891', NATIONAL)).toBeNull();
    // Two that read differently: none taken.
    expect(valueIn('old 1023456789, new 2104556789', NATIONAL)).toBeNull();
    expect(valueIn('1023456789 or 1023456789', NATIONAL)).toMatchObject({ typed: '1023456789' });
  });
});
