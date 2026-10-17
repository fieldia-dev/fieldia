import { canBeMobile, flagOf, phoneCountries, phoneCountry, phoneLinks, phoneParts, readPhone, shownPhone, typedCode, writePhone } from './phone-numbers';
import { PHONE_TABLE } from './phone-table';

/**
 * Phone numbers the world over, by the phone part's table (made from libphonenumber's metadata): read as typed at
 * home or abroad, checked by their country, kept as E.164 and written back as people read them.
 */

describe('the table of countries', () => {
  it('knows every country by its code, its dialling code and the digit it dials at home with', () => {
    expect(phoneCountries().length).toBeGreaterThan(240);
    expect(phoneCountry('EG')).toMatchObject({ code: 'EG', dial: '20', trunk: '0' });
    expect(phoneCountry('us')).toMatchObject({ code: 'US', dial: '1', trunk: '1' });
    expect(phoneCountry('IT')).toMatchObject({ dial: '39', trunk: '' });
    expect(phoneCountry('RU')).toMatchObject({ dial: '7', trunk: '8' });
    expect(phoneCountry('XX')).toBeUndefined();
    expect(phoneCountry(null)).toBeUndefined();
  });

  it('stays small: a tenth of libphonenumber’s weight', () => {
    // 23.1 KB in 0.24; 25.0 with how each country's mobiles start (WhatsApp for those alone).
    expect(PHONE_TABLE.length).toBeLessThan(26 * 1024);
  });

  it('draws a country’s flag from its code', () => {
    expect(flagOf('EG')).toBe('🇪🇬');
    expect(flagOf('gb')).toBe('🇬🇧');
  });
});

describe('a number read', () => {
  const read = (text: string, country?: string | null) => readPhone(text, country);

  it('says a number with letters in it has letters, whatever its digits', () => {
    expect(read('0151 abc', 'DE')).toEqual({ problem: 'letters', country: 'DE' });
    expect(read('+20 10 1234 5678 ext', 'EG')).toEqual({ problem: 'letters', country: 'EG' });
    expect(read('010 1OO 5678', null)).toEqual({ problem: 'letters' });
  });

  it('takes a number typed at home in the country given, its trunk digit dropped, in any digits', () => {
    expect(read('010 1234 5678', 'EG')).toEqual({ number: '+201012345678', country: 'EG' });
    expect(read('01012345678', 'EG')).toEqual({ number: '+201012345678', country: 'EG' });
    expect(read('٠١٠١٢٣٤٥٦٧٨', 'EG')).toEqual({ number: '+201012345678', country: 'EG' });
    expect(read('(02) 2345-6789', 'EG')).toEqual({ number: '+20223456789', country: 'EG' });
    expect(read('(212) 555-0100', 'US')).toEqual({ number: '+12125550100', country: 'US' });
    expect(read('1 212 555 0100', 'US')).toEqual({ number: '+12125550100', country: 'US' });
    expect(read('07911 123456', 'GB')).toEqual({ number: '+447911123456', country: 'GB' });
    expect(read('020 7946 0958', 'GB')).toEqual({ number: '+442079460958', country: 'GB' });
    expect(read('06 12 34 56 78', 'FR')).toEqual({ number: '+33612345678', country: 'FR' });
    expect(read('050 123 4567', 'SA')).toEqual({ number: '+966501234567', country: 'SA' });
    expect(read('06 1234 5678', 'IT')).toEqual({ number: '+390612345678', country: 'IT' });
    expect(read('8 (912) 345-67-89', 'RU')).toEqual({ number: '+79123456789', country: 'RU' });
    expect(read('8 029 491-19-11', 'BY')).toEqual({ number: '+375294911911', country: 'BY' });
  });

  it('takes a number typed abroad’s way, with + or 00 and its code, whatever the country given', () => {
    expect(read('+20 10 1234 5678')).toEqual({ number: '+201012345678', country: 'EG' });
    expect(read('0020 10 1234 5678', 'DE')).toEqual({ number: '+201012345678', country: 'EG' });
    expect(read('+971 50 123 4567', 'EG')).toEqual({ number: '+971501234567', country: 'AE' });
    expect(read('+49 30 1234 5678')).toEqual({ number: '+493012345678', country: 'DE' });
    // A +1 country's own 011 for abroad.
    expect(read('011 20 10 1234 5678', 'US')).toEqual({ number: '+201012345678', country: 'EG' });
    // The trunk digit typed after the code, as people write it: "+44 (0)20…", "+20 010…".
    expect(read('+44 (0)20 7946 0958')).toEqual({ number: '+442079460958', country: 'GB' });
    expect(read('+20 010 1234 5678')).toEqual({ number: '+201012345678', country: 'EG' });
    // Its dialling code typed without its +, at home.
    expect(read('201012345678', 'EG')).toEqual({ number: '+201012345678', country: 'EG' });
  });

  it('tells apart the countries that share a dialling code by how their numbers start', () => {
    expect(read('+1 876 555 0100')).toEqual({ number: '+18765550100', country: 'JM' });
    expect(read('+1 416 555 0100')).toEqual({ number: '+14165550100', country: 'CA' });
    expect(read('+1 212 555 0100')).toEqual({ number: '+12125550100', country: 'US' });
    expect(read('+7 701 123 4567')).toEqual({ number: '+77011234567', country: 'KZ' });
    expect(read('+7 912 345 67 89')).toEqual({ number: '+79123456789', country: 'RU' });
    // Guernsey's mobiles are +44 7911 1…: the country picked first, else the one whose numbers start so.
    expect(read('+44 7911 123456')).toEqual({ number: '+447911123456', country: 'GG' });
    expect(read('+44 7911 123456', 'GB')).toEqual({ number: '+447911123456', country: 'GB' });
    // A Canadian picked, a New York number typed: the number is New York’s.
    expect(read('212 555 0100', 'CA')).toEqual({ number: '+12125550100', country: 'US' });
  });

  it('says why a number does not read: no country, no such code, too short, too long, or a start none has', () => {
    expect(read('010 1234 5678')).toEqual({ problem: 'country' });
    expect(read('010 1234 5678', null)).toEqual({ problem: 'country' });
    expect(read('+999 123 4567')).toEqual({ problem: 'code', start: '+999' });
    expect(read('+2')).toEqual({ problem: 'short', start: '+2' });
    expect(read('010 1234 567', 'EG')).toMatchObject({ problem: 'short', country: 'EG' });
    expect(read('010 1234 56789', 'EG')).toMatchObject({ problem: 'long', country: 'EG' });
    expect(read('014 1234 5678', 'EG')).toEqual({ problem: 'start', country: 'EG', start: '014' });
    expect(read('+20 14 1234 5678')).toEqual({ problem: 'start', country: 'EG', start: '+20 14' });
    expect(read('1', 'EG')).toMatchObject({ problem: 'short', country: 'EG' });
  });

  it('never makes a number of fewer digits than were typed: every digit is the number’s, or it does not read', () => {
    const reading = read('010 1234 56789', 'EG');
    expect('number' in reading).toBe(false);
  });
});

describe('a number written', () => {
  it('abroad’s way, its groups apart with spaces, and at home’s way as its country writes it', () => {
    const both = (number: string, home: string) => [writePhone(number), writePhone(number, 'national', home)];
    expect(both('+201012345678', 'EG')).toEqual(['+20 10 1234 5678', '010 1234 5678']);
    expect(both('+20223456789', 'EG')).toEqual(['+20 2 2345 6789', '02 2345 6789']);
    expect(both('+12125550100', 'US')).toEqual(['+1 212 555 0100', '(212) 555-0100']);
    expect(both('+442079460958', 'GB')).toEqual(['+44 20 7946 0958', '020 7946 0958']);
    expect(both('+33612345678', 'FR')).toEqual(['+33 6 12 34 56 78', '06 12 34 56 78']);
    expect(both('+4915112345678', 'DE')).toEqual(['+49 1511 234 5678', '01511 234 5678']);
    expect(both('+966501234567', 'SA')).toEqual(['+966 50 123 4567', '050 123 4567']);
    expect(both('+971501234567', 'AE')).toEqual(['+971 50 123 4567', '050 123 4567']);
    expect(both('+79123456789', 'RU')).toEqual(['+7 912 345 67 89', '8 (912) 345-67-89']);
    expect(both('+819012345678', 'JP')).toEqual(['+81 90 1234 5678', '090-1234-5678']);
  });

  it('at home’s way only for a number of the home country’s code: another country’s is written abroad’s way', () => {
    expect(writePhone('+971501234567', 'national', 'EG')).toBe('+971 50 123 4567');
    expect(writePhone('+971501234567', 'national')).toBe('+971 50 123 4567');
    // Canada and the United States dial each other at home.
    expect(writePhone('+14165550100', 'national', 'US')).toBe('(416) 555-0100');
  });

  it('leaves text that is no E.164 number as it is, and reads one kept another way first', () => {
    expect(writePhone('ext. 204')).toBe('ext. 204');
    expect(writePhone('+20 10 1234 5678')).toBe('+20 10 1234 5678');
    expect(shownPhone('+20 2 2345 6789')).toBe('+20 2 2345 6789');
    expect(shownPhone('02 2345 6789', 'international', 'EG')).toBe('+20 2 2345 6789');
    expect(shownPhone('+201012345678', 'national', 'EG')).toBe('010 1234 5678');
    expect(shownPhone('ext. 204', 'national', 'EG')).toBe('ext. 204');
  });
});

describe('a number’s parts and links', () => {
  it('splits an E.164 number into its country, its code and its digits', () => {
    expect(phoneParts('+201012345678')).toEqual({ country: 'EG', dial: '20', digits: '1012345678' });
    expect(phoneParts('+20 10 1234 5678')).toBeUndefined();
    expect(phoneParts('+2010123')).toBeUndefined();
  });

  it('calls and chats on WhatsApp with the number, and offers neither for one that is not', () => {
    expect(phoneLinks('+201012345678')).toEqual({ call: 'tel:+201012345678', whatsapp: 'https://wa.me/201012345678' });
    expect(phoneLinks('+20101234567')).toBeUndefined();
    expect(phoneLinks('010 1234 5678')).toBeUndefined();
  });

  it('chats on WhatsApp only with a number that can be a mobile, by its country’s numbers: a fixed line is called', () => {
    // Cairo's fixed line, a German one in Berlin, a London one: called, never chatted with.
    for (const fixed of ['+20225374100', '+493012345678', '+442071234567']) expect(phoneLinks(fixed)).toEqual({ call: `tel:${fixed}` });
    // Egypt's, Germany's, Britain's, Saudi Arabia's, France's mobiles.
    for (const mobile of ['+201012345678', '+4915112345678', '+447911123456', '+966501234567', '+33612345678']) expect(phoneLinks(mobile)?.whatsapp).toBe(`https://wa.me/${mobile.slice(1)}`);
    // Where a mobile cannot be told from a fixed line by its digits (+1's), it may be one: kept.
    expect(phoneLinks('+12125550100')?.whatsapp).toBe('https://wa.me/12125550100');
    expect(canBeMobile('+12125550100')).toBe(true);
    expect(canBeMobile('+20225374100')).toBe(false);
    expect(canBeMobile('not a number')).toBe(false);
  });

  it('knows the code of a number typed abroad’s way as it is typed', () => {
    expect(typedCode('+20 1')).toEqual({ dial: '20', digits: '1' });
    expect(typedCode('00966 5')).toEqual({ dial: '966', digits: '5' });
    expect(typedCode('010')).toBeUndefined();
    expect(typedCode('+999')).toBeUndefined();
  });
});
