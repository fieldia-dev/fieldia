import { LINK_URL, MEDIA_URL, PICTURE_URL, safeUrl, type UrlKind } from './safe-url';

const BASE = 'https://app.example/homes/';
/** What the browser does with an address an element is given: reads it against the page's own (WHATWG, as Node's URL). */
const scheme = (address: string) => new URL(address, BASE).protocol.slice(0, -1);
/** How an attribute's markup would read the address back: its character references decoded. */
const decoded = (text: string) =>
  text
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&colon;/gi, ':')
    .replace(/&tab;/gi, '\t')
    .replace(/&newline;/gi, '\n');

describe('safeUrl', () => {
  it('keeps a web, mail or phone address and a path of this site as it is written', () => {
    for (const address of ['https://ok.example', 'http://ok.example/a?b=1&c=2#d', 'mailto:mona@example.com', 'tel:+201001234567', '/property/7', '?page=2', '#top', 'orders/7'])
      expect(safeUrl(address, LINK_URL, BASE)).toBe(address);
    expect(safeUrl('  https://ok.example  ', LINK_URL, BASE)).toBe('https://ok.example');
  });

  it('refuses a script, a page written as data, and any scheme the place does not allow', () => {
    for (const address of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'vbscript:msgbox(1)', 'VBScript:msgbox(1)', 'data:text/html,<script>alert(1)</script>', 'DATA:text/html;base64,PHNjcmlwdD4=', 'file:///etc/passwd', 'ftp://x.example/a', 'chrome://settings', 'about:blank'])
      expect(safeUrl(address, LINK_URL, BASE)).toBeUndefined();
    expect(safeUrl('mailto:a@b.c', ['http', 'https'], BASE)).toBeUndefined();
    expect(safeUrl('/a', ['http', 'https'], BASE)).toBeUndefined();
    expect(safeUrl('https://ok.example', ['relative'], BASE)).toBeUndefined();
    for (const nothing of [undefined, null, 7, {}, '', '   ']) expect(safeUrl(nothing, LINK_URL, BASE)).toBeUndefined();
  });

  it('reads an address as the browser does: tabs, line breaks and control characters dropped, the scheme in any case (the audit’s bypass of the map card)', () => {
    for (const address of ['\x01javascript:alert(document.domain)', 'java\tscript:alert(1)', 'java\nscript:alert(1)', 'JaVa\rScRiPt:alert(document.domain)', ' javascript:alert(1)', ' javascript:alert(1)', '\x00javascript:alert(1)'])
      expect(safeUrl(address, LINK_URL, BASE)).toBeUndefined();
    // A character no scheme holds makes it a path of this site, which is where the browser goes too.
    expect(scheme(safeUrl('javascript\x7f:alert(1)', LINK_URL, BASE) as string)).toBe('https');
    // Allowed, but written in a way the browser reads otherwise: given back as the browser reads it.
    expect(safeUrl('ht\ttps://ok.example/a', LINK_URL, BASE)).toBe('https://ok.example/a');
  });

  it('never hands markup an address it would read as a script: character references stay a path of this site', () => {
    for (const address of ['javascript&colon;alert(1)', 'javascript&#58;alert(1)', 'javascript&#x3a;alert(1)', 'java&#9;script:alert(1)', 'jav&#x09;ascript:alert(1)', 'java&Tab;script:alert(1)']) {
      const kept = safeUrl(address, LINK_URL, BASE);
      if (kept === undefined) continue;
      expect(scheme(kept)).toBe('https');
      expect(scheme(decoded(kept))).toBe('https');
    }
  });

  it('takes a picture written as data where a picture goes, and nowhere else', () => {
    expect(safeUrl('data:image/png;base64,iVBORw0KGgo=', PICTURE_URL, BASE)).toBe('data:image/png;base64,iVBORw0KGgo=');
    expect(safeUrl('data:image/svg+xml,%3Csvg%3E', PICTURE_URL, BASE)).toBe('data:image/svg+xml,%3Csvg%3E');
    expect(safeUrl('data:image/png;base64,iVBORw0KGgo=', LINK_URL, BASE)).toBeUndefined();
    expect(safeUrl('data:text/html,<b>', PICTURE_URL, BASE)).toBeUndefined();
    expect(safeUrl('\x01data:text/html,<b>', PICTURE_URL, BASE)).toBeUndefined();
  });

  it('takes a blob this page made, never another site’s', () => {
    expect(safeUrl('blob:https://app.example/7f3c', MEDIA_URL, BASE)).toBe('blob:https://app.example/7f3c');
    expect(safeUrl('blob:null/7f3c', MEDIA_URL, BASE)).toBe('blob:null/7f3c');
    expect(safeUrl('blob:https://evil.example/7f3c', MEDIA_URL, BASE)).toBeUndefined();
    expect(safeUrl('blob:https://app.example/7f3c', LINK_URL, BASE)).toBeUndefined();
  });

  it('reads a path against the page’s own address, or refuses it where there is none to read it against', () => {
    expect(safeUrl('/a', LINK_URL, 'about:blank')).toBeUndefined();
    expect(safeUrl('//cdn.example/a.png', PICTURE_URL, BASE)).toBe('//cdn.example/a.png');
    // A server, a test: no page address, the path kept as written.
    expect(safeUrl('/a', LINK_URL)).toBe('/a');
  });

  it('fuzzed: no control character, space, case or reference anywhere in a script’s scheme lets it through', () => {
    const schemes = ['javascript', 'vbscript', 'data', 'livescript'];
    const bodies = [':alert(1)', ':text/html,<script>alert(1)</script>'];
    const inserts = [...Array.from({ length: 0x21 }, (_, i) => String.fromCharCode(i)), '\x7f', ' ', ' ', '﻿', '&#9;', '&#10;', '&Tab;', '&#x0a;'];
    const kinds: (readonly UrlKind[])[] = [LINK_URL, PICTURE_URL, MEDIA_URL];
    let tried = 0;
    for (const word of schemes)
      for (const body of bodies)
        for (const insert of inserts)
          for (let at = 0; at <= word.length + 1; at++) {
            const cased = [...word].map((c, i) => (i % 2 ? c.toUpperCase() : c)).join('');
            for (const written of [word, cased]) {
              const whole = written + body;
              const address = whole.slice(0, at) + insert + whole.slice(at);
              for (const allowed of kinds) {
                tried++;
                const kept = safeUrl(address, allowed, BASE);
                if (kept === undefined) continue;
                // Whatever is kept, the browser — and markup reading it back — finds an allowed scheme in it.
                for (const read of [kept, decoded(kept)]) expect(['http', 'https', 'mailto', 'tel', 'blob']).toContain(scheme(read));
              }
            }
          }
    expect(tried).toBeGreaterThan(5000);
  });
});
