import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pasteTable, sanitizeHtml } from './sanitize';

/**
 * A table pasted into a formatted text from Word, Excel, Google Docs or Google Sheets, kept as plain table markup: the
 * clipboard's HTML as each app writes it (fixtures/clipboard: a quote's price table, its header bold, its amounts at
 * the end of their cells, a total across three columns), cleaned to the same table whichever app it came from — no
 * widths, no columns' sizes, no borders or fonts, no classes — and still nothing that could run.
 */

const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures/clipboard', `${name}.html`), 'utf8');
const right = (words: string) => `<td style="text-align: right;">${words}</td>`;
const HEAD = `<tr><td><b>Service</b></td>${right('<b>Qty</b>')}${right('<b>Unit price</b>')}${right('<b>Amount</b>')}</tr>`;
const LINES = (three: string) =>
  `<tr><td>Discovery workshop</td>${right('2')}${right('1,500.00')}${right('3,000.00')}</tr><tr><td>${three}</td>${right('1')}${right('12,000.00')}${right('12,000.00')}</tr>`;

describe('a table pasted from an office app', () => {
  it('from Word: its words, bold and italic, a total across three cells, the paragraph after it', () => {
    expect(sanitizeHtml(fixture('word-table'), document, true)).toBe(
      '<p><b>4. Fees</b></p><p>The Client pays the fees below within 30 days of each invoice.</p>' +
        `<table><tbody>${HEAD}${LINES('Site build, <i>three languages</i>')}<tr><td style="text-align: right;" colspan="3"><b>Total</b></td>${right('<b>15,000.00</b>')}</tr></tbody></table>` +
        '<p>&nbsp;</p>'
    );
  });

  it('from Excel: bold and aligned by its sheet’s classes, its numbers at their cells’ end, empty cells kept', () => {
    expect(sanitizeHtml(fixture('excel-table'), document, true)).toBe(`<table><tbody>${HEAD}${LINES('Site build, three languages')}<tr><td><b>Total</b></td><td></td><td></td>${right('15,000.00')}</tr></tbody></table>`);
  });

  it('from Google Docs: not all bold (its wrapper says normal), no black written on every word, no block round the table', () => {
    expect(sanitizeHtml(fixture('google-docs-table'), document, true)).toBe(
      '<p><b>4. Fees</b></p><p>The Client pays the fees below within 30 days of each invoice.</p><br>' +
        `<table><tbody>${HEAD}${LINES('Site build, <i>three languages</i>')}<tr><td style="text-align: right;" colspan="3"><b>Total</b></td>${right('<b>15,000.00</b>')}</tr></tbody></table><br>`
    );
  });

  it('from Google Sheets: bold by its cells’ style, the way its columns run kept', () => {
    expect(sanitizeHtml(fixture('google-sheets-table'), document, true)).toBe(
      `<table dir="ltr"><tbody>${HEAD}${LINES('Site build, three languages')}<tr><td><b>Total</b></td><td></td><td></td>${right('<b>15,000.00</b>')}</tr></tbody></table>`
    );
  });

  it('reads the same again: a table kept is kept as it is', () => {
    for (const name of ['word-table', 'excel-table', 'google-docs-table', 'google-sheets-table']) {
      const once = sanitizeHtml(fixture(name), document, true);
      expect(sanitizeHtml(once)).toBe(once);
      expect(sanitizeHtml(once, document, true)).toBe(once);
    }
  });
});

describe('a table stays safe', () => {
  it('runs nothing: no script, event, style, link to script or other attribute in or on it', () => {
    expect(
      sanitizeHtml(
        '<table onclick="x()" style="width:900px" background="https://e.example/a.png" class="MsoTableGrid" border="1" width="600" dir="javascript:x">' +
          '<caption onmouseover="x()">Fees<script>x()</script></caption><colgroup><col width="200" style="width:200px"></colgroup>' +
          '<thead><tr style="height:20px"><th scope="x" abbr="a" onfocus="x()">A<img src="x" onerror="x()"></th></tr></thead>' +
          '<tbody><tr><td style="background:url(javascript:alert(1));width:90px" colspan="2;alert(1)" rowspan="0" headers="h" nowrap>b<svg onload="x()"></svg><iframe src="//e"></iframe></td></tr></tbody>' +
          '<tfoot><tr><td colspan="1001" rowspan="-2"><a href="javascript:alert(1)">c</a></td></tr></tfoot></table>'
      )
    ).toBe('<table><caption>Fees</caption><thead><tr><th>A</th></tr></thead><tbody><tr><td>b</td></tr></tbody><tfoot><tr><td><a>c</a></td></tr></tfoot></table>');
  });

  it('keeps a cell’s span over its neighbours, a header’s scope, a cell’s alignment and the way its columns run', () => {
    expect(sanitizeHtml('<table dir="RTL"><tr><th scope="col" style="text-align:center">A</th><th scope="row" colspan="2" rowspan="3" align="end">B</th></tr></table>')).toBe(
      '<table dir="rtl"><tbody><tr><th style="text-align: center;" scope="col">A</th><th style="text-align: end;" colspan="2" rowspan="3" scope="row">B</th></tr></tbody></table>'
    );
  });

  it('a table with no cell is nothing, and rows outside a table are their words', () => {
    expect(sanitizeHtml('<p>a</p><table><caption>none</caption></table><p>b</p>')).toBe('<p>a</p><p>b</p>');
    expect(sanitizeHtml('<template><tr><td>x</td><td>y</td></tr></template>z')).toBe('z');
    const box = document.createElement('template');
    box.innerHTML = '<tr><td>x</td><td>y</td></tr>';
    expect(sanitizeHtml(box.innerHTML)).toBe('x y ');
  });
});

describe('words a style marks', () => {
  it('bold, italic, underlined or struck by a style keep it as an element; a bold its style undoes is plain', () => {
    expect(sanitizeHtml('<p><span style="font-weight: bold">a</span> <span style="font-weight:700;font-style:italic">b</span> <span style="text-decoration: underline line-through">c</span></p>')).toBe(
      '<p><span><b>a</b></span> <span><i><b>b</b></i></span> <span><s><u>c</u></s></span></p>'
    );
    expect(sanitizeHtml('<b style="font-weight:normal" id="docs-internal-guid-1"><p>plain</p></b><strong style="font-weight: 400">x</strong><em style="font-style: normal">y</em><b>z</b>')).toBe('<p>plain</p>xy<b>z</b>');
  });

  it('pasted, a span that keeps nothing is its words; its colour kept unless it is the words’ own black or white', () => {
    expect(sanitizeHtml('<p><span style="color:#000000;background-color:transparent">a</span><span style="color:#d13438">b</span><span style="background-color:#ffffff">c</span></p>', document, true)).toBe(
      '<p>a<span style="color: rgb(209, 52, 56);">b</span>c</p>'
    );
  });
});

describe('pasting a table into a formatted text', () => {
  const paste = (html: string) => {
    const event = Object.assign(new Event('paste', { cancelable: true }), { clipboardData: { getData: (type: string) => (type === 'text/html' ? html : 'plain') } }) as unknown as ClipboardEvent;
    const commands: [string, string | undefined][] = [];
    (document as unknown as { execCommand: unknown }).execCommand = (command: string, _ui: boolean, value?: string) => commands.push([command, value]);
    return { taken: pasteTable(event, document), prevented: event.defaultPrevented, commands };
  };

  it('puts the table in as plain markup, in one step the browser undoes', () => {
    const { taken, prevented, commands } = paste(fixture('excel-table'));
    expect([taken, prevented]).toEqual([true, true]);
    expect(commands).toEqual([['insertHTML', sanitizeHtml(fixture('excel-table'), document, true)]]);
  });

  it('puts rows copied alone in a table of their own', () => {
    expect(paste('<!--StartFragment--><tr><td>a</td><td align=right>1</td></tr><!--EndFragment-->').commands).toEqual([['insertHTML', '<table><tbody><tr><td>a</td><td style="text-align: right;">1</td></tr></tbody></table>']]);
  });

  it('leaves anything else to the browser, as before', () => {
    expect(paste('<p>Hello <b>you</b></p>')).toEqual({ taken: false, prevented: false, commands: [] });
    expect(paste('')).toEqual({ taken: false, prevented: false, commands: [] });
  });
});
