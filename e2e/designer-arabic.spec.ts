import { expect, test, type Page } from '@playwright/test';
import { axeFindings } from './a11y-support';
import { inAdvanced } from './designer-support';
import { expectNoSidewaysScroll, screen } from './support';

/**
 * The designer in Arabic (`locale: 'ar'`), on a page right to left: every
 * place a person goes — the bar, the rail's tabs, a part picked and each tab
 * of its panel, Try it, JSON, Translations, Rules, and each dialog and menu —
 * read for English left behind, swept by axe, and looked at, at a desktop's
 * width and a phone's. What is the page's or the app's own (its words, its
 * made-up records, its JSON) is data, never translated; the few Latin words
 * the Arabic keeps on purpose are listed with why. And the other way round:
 * the designer in English on a page right to left runs left to right, so its
 * sentences end where English ends them.
 */

/** Latin words the Arabic keeps on purpose — the same list the unit table is held to (designer-words.spec.ts). */
const KEPT = [
  // Keys, and the letters of shortcuts, as keyboards print them.
  ...['Ctrl', 'Shift', 'Alt', 'Enter', 'Esc', 'Tab', 'Home', 'End', 'Delete', 'Backspace', 'K', 'J', 'Z', 'Y', 'D', 'C', 'V', 'X', 'A', 'G'],
  // Formats and currencies, written so in Arabic too.
  ...['JSON', 'CSV', 'PDF', 'USD', 'EGP', 'IBAN', 'URL', 'https'],
  // Fieldia's own name, as its look's.
  'Fieldia',
  // JSON's own words, and language tags, as examples of what to type.
  ...['true', 'false', 'null', 'ar', 'es', 'pt-BR'],
];

/** Where the words are the page's or the app's, not the designer's, and why. */
const DATA: [selector: string, why: string][] = [
  ['.fd-try-frame', 'the form being tried: the page’s own words, in the language it is tried in'],
  ['.fd-list-table tbody', 'the made-up records a list is drawn with'],
  ['.fd-json-code', 'the page as JSON: code'],
  ['[lang]:not([lang|="ar"])', 'words marked as another language: “English” beside “العربية”, a language’s own name'],
  ['.fd-assist-name, .fd-assist-note', 'the app’s assistant, in the app’s words'],
  ['code, .fd-data-model', 'names and types as the data has them — a field’s name, its type, the model’s name: code'],
  ['.fd-formula-function', 'a formula’s functions, as they are typed in it: round, min, max, if, abs'],
  ['.demo-bar', 'the demo page’s own bar, not the designer'],
];

/**
 * What axe finds that is not about the language, found in English too, and
 * why it is not a failure here: kept short, each said in the report.
 */
const AXE_KNOWN: [rule: string, where: string, why: string][] = [
  [
    'scrollable-region-focusable',
    '.fd-menu',
    'The field bar’s menus (how a field is shown, its width) are WAI-ARIA menus: the arrow keys move the focus from item to item (each tabindex -1) and scroll it into view, so a long menu is read whole by keyboard. The same finding shows in English; the English sweep (a11y.spec.ts) does not open these menus.',
  ],
];
const known = (line: string) => AXE_KNOWN.some(([rule, where]) => line.includes(` · ${rule} · `) && line.includes(where));

/** Code, as an example writes it: a function and what it reads, a colour, an address, an escape, a place in a sentence. */
const CODE = /\b[a-z_]+\([^)]*\)|#\w+|https?:\/\/\S*|mailto:\S*|\\[a-z]|\{[a-z]+\}/g.source;

/** Visible words of the designer, its names and its hints, with English in them that is not data. */
function latinLeft(page: Page): Promise<string[]> {
  return page.evaluate(
    ({ kept, data, code }) => {
      const skip = [...data, 'script', 'style', 'textarea', 'noscript'].join(', ');
      const latin = (text: string) => (text.replace(new RegExp(code, 'g'), '').match(/[A-Za-z][A-Za-z0-9_'’-]*/g) ?? []).filter((word) => !kept.includes(word));
      const where = (element: Element) => {
        const named = element.closest('[class*="fd-"]');
        return `${element.tagName.toLowerCase()}${named ? `.${[...named.classList].filter((c) => c.startsWith('fd-')).slice(0, 2).join('.')}` : ''}`;
      };
      const shown = (element: Element) => element.checkVisibility({ checkVisibilityCSS: true });
      const found = new Set<string>();
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement;
        if (!parent || parent.closest(skip) || !shown(parent)) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        if (![...range.getClientRects()].some((r) => r.width > 0 && r.height > 0)) continue;
        const words = latin(node.textContent ?? '');
        if (words.length) found.add(`${where(parent)}: “${node.textContent?.trim().slice(0, 90)}” (${words.join(' ')})`);
      }
      const names = ['aria-label', 'title', 'placeholder', 'aria-description', 'aria-roledescription', 'alt'];
      for (const element of document.body.querySelectorAll(names.map((n) => `[${n}]`).join(', '))) {
        if (element.closest(skip) || !shown(element)) continue;
        for (const name of names) {
          const value = element.getAttribute(name);
          const words = value ? latin(value) : [];
          if (words.length) found.add(`${where(element)} [${name}]: “${value?.slice(0, 90)}” (${words.join(' ')})`);
        }
      }
      return [...found];
    },
    { kept: KEPT, data: DATA.map(([selector]) => selector), code: CODE }
  );
}

/** Words cut off: a name, a tab or a button whose words do not fit its box, or a part of the designer past the window's edges. */
function clipped(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const found: string[] = [];
    const scrollsAcross = (element: Element) => !!element.closest('.fd-words-scroll, .fd-list-scroll, .fd-json-code, .fd-rules-table-scroll, .fd-try-frame, .fd-toolbox-scroll, [class*="scroll"]');
    for (const element of document.querySelectorAll<HTMLElement>('.fd-designer button, .fd-designer [role="tab"], .fd-designer .fd-prop-name, .fd-designer h2, .fd-designer h3, .fd-designer label, [role="dialog"] button, [role="menu"] [role^="menuitem"]')) {
      // The form tried is the viewer's, and its own gates look at it; a name kept for a screen reader alone is meant to be one pixel wide.
      if (!element.checkVisibility({ checkVisibilityCSS: true }) || !element.textContent?.trim() || element.closest('.fd-try-frame') || element.clientWidth <= 1) continue;
      const style = getComputedStyle(element);
      const cuts = style.overflowX === 'hidden' || style.overflowX === 'clip' || style.textOverflow === 'ellipsis';
      if (cuts && element.scrollWidth > element.clientWidth + 1) found.push(`cut: ${element.className || element.tagName} “${element.textContent.trim().slice(0, 60)}”`);
      const box = element.getBoundingClientRect();
      if (!scrollsAcross(element) && box.width > 0 && (box.left < -1 || box.right > innerWidth + 1)) found.push(`past the edge: ${element.className || element.tagName} “${element.textContent.trim().slice(0, 60)}” (${Math.round(box.left)}–${Math.round(box.right)} of ${innerWidth})`);
    }
    return found;
  });
}

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

/** A rule, as a person sets one: `shown` shows only when `when` has its last option (or is ticked). */
async function addRule(page: Page, shown: string, when: string) {
  await page.evaluate(
    ([shownLabel, whenLabel]) => {
      type Node = { type: string; id: string; field?: string; children?: Node[] };
      const designer = (window as unknown as { fieldiaDesigner: { designer: { getPage(): any; setCondition(id: string, condition: unknown): boolean } } }).fieldiaDesigner.designer;
      const built = designer.getPage();
      const nameOf = (label: string) => Object.entries(built.fields as Record<string, { label: string }>).find(([, f]) => f.label === label)?.[0] as string;
      const walk = (nodes: Node[]): Node[] => nodes.flatMap((n) => (n.type === 'field' ? [n] : n.children ? walk(n.children) : []));
      const node = walk(built.layout.children).find((n) => n.field === nameOf(shownLabel)) as Node;
      const field = built.fields[nameOf(whenLabel)] as { options?: { value: unknown }[] };
      if (!designer.setCondition(node.id, { field: nameOf(whenLabel), equals: field.options ? field.options[field.options.length - 1].value : true })) throw new Error('the rule was refused');
    },
    [shown, when]
  );
}

interface Run {
  name: string;
  url: string;
  /** How a part is picked on its canvas. */
  part: string;
  survey?: boolean;
  advanced?: boolean;
  /** What to do first: a template to start from, a field and the header's parts on a blank sheet. */
  prepare?: (page: Page, look: (state: string, shot?: boolean) => Promise<void>) => Promise<void>;
}

const RUNS: Run[] = [
  {
    name: 'survey',
    url: '/designer/?locale=ar&dir=rtl',
    part: '.fd-q-closed',
    survey: true,
    // A blank survey offers templates in Arabic: one picked, its pages are written in Arabic too.
    prepare: async (page, look) => {
      await expect(page.locator('.fd-start')).toBeVisible();
      await look('templates', true);
      await page.locator('[data-template="event-registration"]').click();
      await expect(page.locator('.fd-start-done')).toBeVisible();
      await look('template picked', true);
      await addRule(page, 'هل هناك ما ينبغي أن نعرفه؟', 'الاحتياجات الغذائية');
    },
  },
  {
    name: 'screen',
    url: '/screen/?locale=ar&dir=rtl',
    part: '.fd-canvas-field',
    advanced: true,
    prepare: (page) => addRule(page, 'هل يتصل المدير؟', 'الخطوة التالية'),
  },
  {
    name: 'sheet',
    url: '/screen/?locale=ar&dir=rtl&start=sheet',
    part: '.fd-canvas-field',
    advanced: true,
    prepare: async (page) => {
      await page.locator('.fd-toolbox [data-tool="model:email"]').click();
      await page.getByRole('button', { name: 'إضافة مراحل الحالة' }).click();
      await page.getByRole('button', { name: 'إضافة زر' }).first().click();
      await page.keyboard.press('Escape');
    },
  },
  { name: 'list', url: '/screen/?locale=ar&dir=rtl&start=list', part: '.fd-list-table th[data-node]' },
  { name: 'blank screen', url: '/screen/?locale=ar&dir=rtl&start=blank', part: '.fd-canvas-section' },
];

/** Each place a person goes, read, swept and — where `shot` — kept as a picture to look at. */
async function walk(page: Page, run: Run, tag: string, phone: boolean): Promise<string[]> {
  const found: string[] = [];
  const look = async (state: string, shot = false, dialog = false) => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
    // On a phone the page stacks: the whole of it, but for a dialog, which covers what is in view.
    if (shot) await screen(page, `arabic-${tag}-${state}`.replace(/[^\w-]+/g, '-'), { viewport: !phone || dialog });
    found.push(...(await latinLeft(page)).map((line) => `${tag} · ${state} · English: ${line}`));
    found.push(...(await clipped(page)).map((line) => `${tag} · ${state} · ${line}`));
    found.push(...(await axeFindings(page, `${tag} · ${state}`)).filter((line) => !known(line)));
    await expectNoSidewaysScroll(page);
  };
  await page.goto(run.url);
  await expect(page.locator('.fd-designer-bar')).toBeVisible();
  await expect(page.locator('.fd-designer')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('.fd-designer')).toHaveAttribute('lang', 'ar');
  await run.prepare?.(page, look);
  await look('start', true);

  const railTabs = page.locator('.fd-rail [role="tab"]');
  for (let i = 1; i < (await railTabs.count()); i++) {
    if (!(await railTabs.nth(i).isVisible())) continue;
    await railTabs.nth(i).click();
    await look(`rail ${i}`, i === 1);
  }
  if (await railTabs.first().isVisible()) await railTabs.first().click();

  await page.locator(run.part).first().click();
  await look('picked', true);
  const panelTabs = page.locator('.fd-properties [role="tab"]');
  for (let i = 0; i < (await panelTabs.count()); i++) {
    await panelTabs.nth(i).click();
    await look(`panel tab ${i}`, i > 0);
  }
  // The field bar's menus on the Advanced canvas: how it is shown, and its width.
  if (run.advanced) {
    const menus = page.locator('.fd-field-bar [aria-haspopup="menu"]');
    for (let i = 0; i < (await menus.count()); i++) {
      if (!(await menus.nth(i).isVisible())) continue;
      await menus.nth(i).click();
      await expect(page.locator('.fd-menu')).toBeVisible();
      await look(`bar menu ${i}`, true, true);
      await page.keyboard.press('Escape');
    }
  }

  for (const mode of ['try', 'json', 'translations', 'rules']) {
    await page.locator(`.fd-mode [data-mode="${mode}"]`).click();
    await page.waitForTimeout(250);
    await look(`${mode} view`, true);
    await page.locator('.fd-mode [data-mode="design"]').click();
  }

  const dialogs: [string, () => Promise<unknown>][] = [
    ['find anything', () => page.keyboard.press('ControlOrMeta+k')],
    ['checks', () => page.locator('.fd-checks-button').click()],
    ['publish', () => page.locator('.fd-designer-bar .fd-button-primary').click()],
    ['shortcuts', () => page.keyboard.type('?')],
    ['versions', () => page.locator('.fd-designer-status').click()],
    ...(run.survey ? ([['look', () => page.locator('.fd-look-button').click()]] as [string, () => Promise<unknown>][]) : []),
  ];
  for (const [name, open] of dialogs) {
    await page.locator('body').click({ position: { x: 2, y: 2 } });
    await open();
    await page.waitForTimeout(200);
    await look(name, true, true);
    await page.keyboard.press('Escape');
  }
  return found;
}

test.describe('the designer in Arabic', () => {
  for (const run of RUNS) {
    for (const [size, viewport] of [['desktop', DESKTOP], ['phone', PHONE]] as const) {
      const tag = `${run.name}-${size}`;
      test(`${run.name} · ${size}: Arabic throughout, right to left, nothing cut, axe clean`, async ({ page }) => {
        test.setTimeout(300_000);
        await page.setViewportSize(viewport);
        if (run.advanced) await inAdvanced(page);
        const problems: string[] = [];
        page.on('pageerror', (error) => problems.push(error.message));
        expect(await walk(page, run, tag, size === 'phone')).toEqual([]);
        expect(problems).toEqual([]);
      });
    }
  }

  test('on a page left to right, the designer still runs right to left; the screen drawn runs as the page does', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/screen/?locale=ar');
    await expect(page.locator('.fd-designer')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('.fd-canvas:not(.fd-list-canvas)')).toHaveAttribute('dir', 'ltr');
    await screen(page, 'arabic-on-a-page-left-to-right', { viewport: true });
    expect(await latinLeft(page)).toEqual([]);
  });
});

test.describe('the gate itself', () => {
  test('finds English where it is: the designer given no language, on the same Arabic page, reads as English', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    // No `locale`: the designer's words are English, and nothing marks them so — the check must find them.
    await page.goto('/screen/?dir=rtl');
    await expect(page.locator('.fd-designer-bar')).toBeVisible();
    const left = await latinLeft(page);
    expect(left.length).toBeGreaterThan(20);
    expect(left.join('\n')).toContain('Draft, not published yet');
  });
});

test.describe('the designer in English on a page right to left', () => {
  test('runs left to right, its sentences ending where English ends them; the screen drawn runs right to left', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/screen/?locale=en&dir=rtl');
    await expect(page.locator('.fd-designer')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('.fd-designer')).toHaveAttribute('lang', 'en');
    await expect(page.locator('.fd-canvas:not(.fd-list-canvas)')).toHaveAttribute('dir', 'rtl');
    // Nothing picked: the panel's hint is a sentence or two of English; each full stop sits to the right of the words before it.
    await page.locator('body').click({ position: { x: 2, y: 2 } });
    const ends = await page.evaluate(() => {
      const hint = [...document.querySelectorAll<HTMLElement>('.fd-properties p')].find(
        (p) => p.checkVisibility() && p.childNodes.length === 1 && p.firstChild?.nodeType === Node.TEXT_NODE && /[a-z]\.$/.test(p.textContent?.trim() ?? '')
      ) as HTMLElement;
      const text = hint.firstChild as Text;
      const at = (from: number, to: number) => {
        const range = document.createRange();
        range.setStart(text, from);
        range.setEnd(text, to);
        const rects = [...range.getClientRects()];
        return rects[rects.length - 1];
      };
      const words = text.data.trimEnd();
      const stop = at(words.length - 1, words.length);
      const before = at(words.length - 2, words.length - 1);
      return { words, stopLeft: stop.left, beforeRight: before.right, direction: getComputedStyle(hint).direction };
    });
    expect(ends.direction).toBe('ltr');
    expect(ends.stopLeft).toBeGreaterThanOrEqual(ends.beforeRight - 1);
    await screen(page, 'english-on-a-page-right-to-left', { viewport: true });
  });
});
