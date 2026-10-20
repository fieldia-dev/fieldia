import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanPasted, pasteHtml } from './pasted-html';
import { sanitizeHtml } from './sanitize';

/**
 * What is pasted into a formatted text from Word, Excel, Google Docs or Google Sheets, kept as plain markup: the
 * clipboard's HTML as each app writes it (fixtures/clipboard: a quote's price table, its header bold, its amounts at
 * the end of their cells, a total across three columns; a clause's heading, marked words, link, lists and a centred
 * line), cleaned to the same whichever app it came from — no widths, no columns' sizes, no borders, fonts, colours or
 * classes — and still nothing that could run.
 */

const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures/clipboard', `${name}.html`), 'utf8');
const right = (words: string) => `<td style="text-align: right;">${words}</td>`;
const HEAD = `<tr><td><b>Service</b></td>${right('<b>Qty</b>')}${right('<b>Unit price</b>')}${right('<b>Amount</b>')}</tr>`;
const LINES = (three: string) =>
  `<tr><td>Discovery workshop</td>${right('2')}${right('1,500.00')}${right('3,000.00')}</tr><tr><td>${three}</td>${right('1')}${right('12,000.00')}${right('12,000.00')}</tr>`;

describe('a table pasted from an office app', () => {
  it('from Word: its words, bold and italic, a total across three cells, the paragraph after it', () => {
    expect(cleanPasted(fixture('word-table'), document)).toBe(
      '<p><b>4. Fees</b></p><p>The Client pays the fees below within 30 days of each invoice.</p>' +
        `<table><tbody>${HEAD}${LINES('Site build, <i>three languages</i>')}<tr><td style="text-align: right;" colspan="3"><b>Total</b></td>${right('<b>15,000.00</b>')}</tr></tbody></table>` +
        '<p>&nbsp;</p>'
    );
  });

  it('from Excel: bold and aligned by its sheet’s classes, its numbers at their cells’ end, empty cells kept', () => {
    expect(cleanPasted(fixture('excel-table'), document)).toBe(`<table><tbody>${HEAD}${LINES('Site build, three languages')}<tr><td><b>Total</b></td><td></td><td></td>${right('15,000.00')}</tr></tbody></table>`);
  });

  it('from Google Docs: not all bold (its wrapper says normal), no black written on every word, no block round the table', () => {
    expect(cleanPasted(fixture('google-docs-table'), document)).toBe(
      '<p><b>4. Fees</b></p><p>The Client pays the fees below within 30 days of each invoice.</p><br>' +
        `<table><tbody>${HEAD}${LINES('Site build, <i>three languages</i>')}<tr><td style="text-align: right;" colspan="3"><b>Total</b></td>${right('<b>15,000.00</b>')}</tr></tbody></table><br>`
    );
  });

  it('from Google Sheets: bold by its cells’ style, the way its columns run kept', () => {
    expect(cleanPasted(fixture('google-sheets-table'), document)).toBe(
      `<table dir="ltr"><tbody>${HEAD}${LINES('Site build, three languages')}<tr><td><b>Total</b></td><td></td><td></td>${right('<b>15,000.00</b>')}</tr></tbody></table>`
    );
  });

  it('reads the same again: a table kept is kept as it is', () => {
    for (const name of ['word-table', 'excel-table', 'google-docs-table', 'google-sheets-table']) {
      const once = cleanPasted(fixture(name), document);
      expect(sanitizeHtml(once)).toBe(once);
      expect(cleanPasted(once, document)).toBe(once);
    }
  });
});

describe('text pasted from an office app or a page', () => {
  const TERMS =
    '<h2>Payment terms</h2><p>The Client pays <b>within 30 days</b>; a <i>late payment</i> adds 2% a month. See <a href="https://nile.example/terms">the full terms</a>.</p>' +
    '<ul><li>Design<ul><li>Brand guide</li></ul></li><li>Build</li></ul><ol><li>Sign</li><li>Pay the first part</li></ol>';

  it('from Word: its heading, marks and link kept, its lists lists again — nested, numbered — its fonts and colours gone', () => {
    // Its centred last line ends in the line break written in it; the second Word writes for other programs is gone.
    expect(cleanPasted(fixture('word-text'), document)).toBe(`${TERMS}<p style="text-align: center;">Thank you<br></p>`);
  });

  it('from Google Docs: the same, its list nested beside an item put in it, its highlight and link’s blue gone', () => {
    expect(cleanPasted(fixture('google-docs-text'), document)).toBe(`${TERMS}<p style="text-align: center;">Thank you</p>`);
  });

  it('from a page: its classes, fonts, colours and sizes gone; a person linked in place kept', () => {
    expect(
      cleanPasted(
        '<div class="post" style="font-family: Georgia; color: #333"><h3 style="font-size: 30px; color: navy">Notes</h3><p>Call <span data-mention="7" style="color: #0078d4">@Karim</span> <span style="background-color: #ffff00; font-size: 20px">today</span>, <u>before</u> <s>noon</s>.</p></div>',
        document
      )
    ).toBe('<div><h3>Notes</h3><p>Call <span data-mention="7">@Karim</span> today, <u>before</u> <s>noon</s>.</p></div>');
  });

  it('Word’s lists one by one: a new list where its number changes, letters numbered, a symbol a bullet', () => {
    const item = (list: number, level: number, mark: string, words: string) =>
      `<p class=MsoListParagraph style='mso-list:l${list} level${level} lfo1'><![if !supportLists]><span style='font-family:Wingdings'><span style='mso-list:Ignore'>${mark}<span>&nbsp;&nbsp;</span></span></span><![endif]>${words}</p>`;
    expect(cleanPasted(`${item(0, 1, 'a.', 'One')}${item(0, 1, 'b.', 'Two')}<p class=MsoNormal>Between</p>${item(1, 1, '§', 'Three')}${item(2, 1, 'i.', 'Four')}`, document)).toBe(
      '<ol><li>One</li><li>Two</li></ol><p>Between</p><ul><li>Three</li></ul><ol><li>Four</li></ol>'
    );
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

  it('pasted, a span is its words: its colour, highlight and size the field’s own', () => {
    expect(cleanPasted('<p><span style="color:#000000;background-color:transparent">a</span><span style="color:#d13438">b</span><span style="background-color:#ffff00;font-size:20px">c</span></p>', document)).toBe('<p>abc</p>');
  });
});

describe('pasting a table into a formatted text', () => {
  const paste = (html: string) => {
    const event = Object.assign(new Event('paste', { cancelable: true }), { clipboardData: { getData: (type: string) => (type === 'text/html' ? html : 'plain') } }) as unknown as ClipboardEvent;
    const commands: [string, string | undefined][] = [];
    (document as unknown as { execCommand: unknown }).execCommand = (command: string, _ui: boolean, value?: string) => commands.push([command, value]);
    return { taken: pasteHtml(event, document, document.body), prevented: event.defaultPrevented, commands };
  };

  it('puts the table in as plain markup, in one step the browser undoes', () => {
    const { taken, prevented, commands } = paste(fixture('excel-table'));
    expect([taken, prevented]).toEqual([true, true]);
    expect(commands).toEqual([['insertHTML', cleanPasted(fixture('excel-table'), document)]]);
  });

  it('puts rows copied alone in a table of their own', () => {
    expect(paste('<!--StartFragment--><tr><td>a</td><td align=right>1</td></tr><!--EndFragment-->').commands).toEqual([['insertHTML', '<table><tbody><tr><td>a</td><td style="text-align: right;">1</td></tr></tbody></table>']]);
  });

  it('puts in any other markup plain too, and leaves words alone (no HTML) to the browser, as before', () => {
    expect(paste('<p style="font-family: Georgia">Hello <b>you</b></p>')).toEqual({ taken: true, prevented: true, commands: [['insertHTML', '<p>Hello <b>you</b></p>']] });
    expect(paste('')).toEqual({ taken: false, prevented: false, commands: [] });
  });
});

describe('the classic formatted text', () => {
  it('keeps a table pasted from Excel, made plain by the text part, where the caret was', async () => {
    const { mountKind } = await import('./test-kinds');
    const { el, value } = mountKind({ type: 'html', label: 'Terms' });
    const area = el.querySelector('.fd-richtext') as HTMLElement;
    const commands: string[] = [];
    (document as unknown as { execCommand: unknown }).execCommand = (command: string, _ui: boolean, html?: string) => {
      commands.push(command);
      const range = document.getSelection()?.getRangeAt(0);
      if (command === 'insertHTML' && range && html) range.insertNode(range.createContextualFragment(html));
      area.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    };
    area.focus();
    const range = document.createRange();
    range.setStart(area, 0);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    const paste = Object.assign(new Event('paste', { bubbles: true, cancelable: true }), { clipboardData: { getData: (type: string) => (type === 'text/html' ? fixture('excel-table') : '') } });
    area.dispatchEvent(paste);
    expect(paste.defaultPrevented).toBe(true);
    await new Promise((done) => setTimeout(done));
    expect(commands).toEqual(['insertHTML']);
    expect(value()).toBe(cleanPasted(fixture('excel-table'), document));
  });
});
