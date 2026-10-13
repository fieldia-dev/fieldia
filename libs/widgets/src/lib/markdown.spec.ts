import { htmlToMarkdown, markdownLoses, markdownToHtml } from './markdown';
import { sanitizeHtml } from './sanitize';

/**
 * Markdown both ways, written by hand: a field edited in Markdown is stored as
 * clean HTML, and that HTML reads back as the same Markdown to edit again.
 */

describe('Markdown to HTML', () => {
  it('writes paragraphs, marks, code and headings', () => {
    expect(markdownToHtml('Release **3** of *15* items, ~~twice~~ `once`.\n\nThen count again.')).toBe(
      '<p>Release <strong>3</strong> of <em>15</em> items, <s>twice</s> <code>once</code>.</p><p>Then count again.</p>'
    );
    expect(markdownToHtml('# Steps\n## Expected\n### Seen\n#### Notes')).toBe('<h1>Steps</h1><h2>Expected</h2><h3>Seen</h3><h4>Notes</h4>');
    expect(markdownToHtml('__bold__ and _italic_ and snake_case_name')).toBe('<p><strong>bold</strong> and <em>italic</em> and snake_case_name</p>');
    expect(markdownToHtml('```\nconst a = 1 < 2;\n```')).toBe('<pre><code>const a = 1 &lt; 2;</code></pre>');
    expect(markdownToHtml('==look here==')).toBe('<p><span style="background-color: rgb(255, 255, 0);">look here</span></p>');
  });

  it('breaks a line where it ends in two spaces or a backslash, and runs on elsewhere', () => {
    expect(markdownToHtml('one  \ntwo\\\nthree\nfour')).toBe('<p>one<br>two<br>three\nfour</p>');
  });

  it('links web and mail addresses, bare or in brackets, and pictures from the web', () => {
    expect(markdownToHtml('https://shop.example/orders/SO-2088?tab=history')).toBe(
      '<p><a href="https://shop.example/orders/SO-2088?tab=history">https://shop.example/orders/SO-2088?tab=history</a></p>'
    );
    expect(markdownToHtml('See [the order](https://shop.example/o/1), <mailto:ops@shop.example> or https://shop.example.')).toBe(
      '<p>See <a href="https://shop.example/o/1">the order</a>, <a href="mailto:ops@shop.example">mailto:ops@shop.example</a> or <a href="https://shop.example">https://shop.example</a>.</p>'
    );
    expect(markdownToHtml('![scan](https://shop.example/scan.png)')).toBe('<p><img src="https://shop.example/scan.png" alt="scan"></p>');
    // An address that could run script stays words.
    expect(markdownToHtml('[x](javascript:alert(1)) ![y](http://plain.example/a.png)')).toBe('<p>[x](javascript:alert(1)) <a href="http://plain.example/a.png">y</a></p>');
  });

  it('escapes raw HTML: it shows as written and never runs', () => {
    expect(markdownToHtml('<img src=x onerror=alert(1)> & <b>')).toBe('<p>&lt;img src=x onerror=alert(1)&gt; &amp; &lt;b&gt;</p>');
    expect(markdownToHtml('\\*not italic\\* and \\# not a heading')).toBe('<p>*not italic* and # not a heading</p>');
  });

  it('writes lists, numbered lists, checklists, nested lists and quotes', () => {
    expect(markdownToHtml('- one\n- two\n* three')).toBe('<ul><li>one</li><li>two</li></ul><ul><li>three</li></ul>');
    expect(markdownToHtml('1. open the order\n2. release 3 items')).toBe('<ol><li>open the order</li><li>release 3 items</li></ol>');
    expect(markdownToHtml('- [ ] count\n- [x] scan')).toBe('<ul><li data-task="open">count</li><li data-task="done">scan</li></ul>');
    expect(markdownToHtml('- shelf\n  - top\n  - bottom\n- floor')).toBe('<ul><li>shelf<ul><li>top</li><li>bottom</li></ul></li><li>floor</li></ul>');
    expect(markdownToHtml('> the scanner is offline\n> until Sunday')).toBe('<blockquote><p>the scanner is offline\nuntil Sunday</p></blockquote>');
  });

  it('gives nothing for nothing, and keeps a reference’s key as words', () => {
    expect(markdownToHtml('')).toBe('');
    expect(markdownToHtml('  \n\n')).toBe('');
    expect(markdownToHtml('#4127 is the same as !12')).toBe('<p>#4127 is the same as !12</p>');
  });

  it('writes what the sanitizer keeps as it is', () => {
    for (const md of ['**a** *b* ~~c~~ `d`', '- [ ] e\n- [x] f', '[g](https://h.example)', '==i==', '1. j\n2. k']) {
      const html = markdownToHtml(md);
      expect(sanitizeHtml(html)).toBe(html);
    }
  });
});

describe('HTML to Markdown', () => {
  const both = (md: string) => expect(htmlToMarkdown(markdownToHtml(md))).toBe(md);

  it('reads back the Markdown the HTML was written from', () => {
    both('Release **3** of *15* items, ~~twice~~ `once`.\n\nThen count again.');
    both('# Steps\n\n## Expected');
    both('https://shop.example/orders/SO-2088?tab=history');
    both('See [the order](https://shop.example/o/1).');
    both('- one\n- two');
    both('1. open\n2. release');
    both('- [ ] count\n- [x] scan');
    both('- shelf\n  - top\n  - bottom\n- floor');
    both('> quoted');
    both('==look here==');
    both('```\nconst a = 1 < 2;\n```');
    both('one\\\ntwo');
  });

  it('writes a rich text’s HTML as Markdown, escaping what would read as marks', () => {
    expect(htmlToMarkdown('<p><b>Bold</b> <i>it</i> 2 * 3 = 6, a_b and [x]</p><div>next</div>')).toBe('**Bold** *it* 2 \\* 3 = 6, a\\_b and \\[x\\]\n\nnext');
    expect(htmlToMarkdown('<p># not a heading</p><p>1. not a list</p>')).toBe('\\# not a heading\n\n1\\. not a list');
    expect(htmlToMarkdown('<p><a href="mailto:ops@shop.example">mailto:ops@shop.example</a></p>')).toBe('<mailto:ops@shop.example>');
    expect(htmlToMarkdown('<p><img src="https://shop.example/a.png" alt="scan"></p>')).toBe('![scan](https://shop.example/a.png)');
  });
});

describe('what Markdown would lose', () => {
  it('names underlining, colours, sizes, alignment and people or records linked in place', () => {
    expect(markdownLoses('<p><b>bold</b> <a href="https://x.example">x</a> <span style="background-color: #ffff00;">hi</span></p><ul><li data-task="open">t</li></ul>')).toBe(false);
    expect(markdownLoses('<p><u>under</u></p>')).toBe(true);
    expect(markdownLoses('<p><span style="color: rgb(209, 52, 56);">red</span></p>')).toBe(true);
    expect(markdownLoses('<p><span style="font-size: 20px;">big</span></p>')).toBe(true);
    expect(markdownLoses('<p style="text-align: center;">mid</p>')).toBe(true);
    expect(markdownLoses('<p><span data-mention="2">@Karim Fathy</span></p>')).toBe(true);
  });
});

describe('Markdown’s held parts', () => {
  it('never runs an address into the code beside it, and keeps a private mark typed in the words out', () => {
    expect(markdownToHtml('https://shop.example`code`')).toBe('<p><a href="https://shop.example">https://shop.example</a><code>code</code></p>');
    expect(markdownToHtml('a0b')).toBe('<p>a0b</p>');
  });
});
