import { expect, type FileChooser, type Locator, type Page } from '@playwright/test';

/**
 * A person's hand on a demo, for its how-to replayed (e2e/how-to.spec.ts): the mouse and the keys on a desktop, a
 * finger on the phone. Every step a replay takes goes through what a person can do — a press where the control is
 * drawn, keys typed one by one, a drag in steps — never a value set from code; and what it checks is what a person
 * sees (`see`), counted, so a step that checks nothing on the screen fails.
 */
export interface Hand {
  readonly page: Page;
  /** Replayed on the phone: WebKit, 390 px, a finger — no hover, no keyboard shortcuts, no window to narrow. */
  readonly phone: boolean;
  /** The key a step's "Ctrl+…" (⌘+… on a Mac) means here: Control. */
  readonly mod: 'Control' | 'Meta';
  /** A press where a person presses: the control scrolled into view, then a finger's tap or the mouse's click. */
  press(target: Locator, options?: { position?: { x: number; y: number }; modifiers?: ('Shift' | 'Control' | 'Alt' | 'Meta')[] }): Promise<void>;
  /** Into a box by a press, then each key typed in turn, as a person types (what was in it stays unless `clear`). */
  type(target: Locator, words: string, options?: { clear?: boolean }): Promise<void>;
  /** Keys on the keyboard, one after another, wherever the focus is: 'Enter', 'Tab', 'Shift+Tab', 'Control+Enter'. */
  keys(...keys: string[]): Promise<void>;
  /** The mouse pressed on `from`, moved in steps a hand takes, let go on `to` (a place, or a point on the page). */
  drag(from: Locator, to: Locator | { x: number; y: number }, options?: { steps?: number }): Promise<void>;
  /** Files chosen as a person chooses them: the control pressed, the browser's file dialog answered with `files`. */
  pick(target: Locator, files: Parameters<FileChooser['setFiles']>[0]): Promise<void>;
  /** The pointer resting on a control, as a person's mouse does (never on the phone, which has none). */
  hover(target: Locator): Promise<void>;
  /** A link a step names — "Read it in [Turkish](?locale=tr)" — followed as a person does: from the steps' panel. */
  follow(words: string | RegExp): Promise<void>;
  /** What a person sees, checked: Playwright's `expect` on a part of the screen, counted for the step. */
  see(target: Locator, message?: string): ReturnType<typeof expect<Locator>>;
  /** The page as a whole seen — its address, its title — counted for the step as `see` is. */
  seePage(message?: string): ReturnType<typeof expect<Page>>;
  /** The demo's own handle (window.fieldiaDemo), for what reached the app — beside `see`, never instead of it. */
  demo<T>(path: string): Promise<T>;
}

/** One step of a demo's how-to, replayed. */
export interface Replay {
  /**
   * The step's first words as the catalogue writes them — 24 characters or more, its links' words without their
   * addresses: a step reworded, added or moved no longer matches, and is replayed again by hand.
   */
  says: string;
  /**
   * Why this step is not replayed on the phone, in words — a key a phone has none of, a mouse's hover, a window
   * narrowed — when it cannot be; a phone replays every other step.
   */
  notOnPhone?: string;
  run(hand: Hand): Promise<void>;
}

/** A demo's how-to, replayed step by step in one page, as a person follows it. */
export interface DemoReplay {
  steps: Replay[];
  /**
   * Console errors the demo writes on purpose (a part shown failing, a server shown down), each by its words: any
   * other error, or an uncaught exception, fails the replay.
   */
  allow?: RegExp[];
  /** Why the demo is not replayed on the phone at all, when no step of it can be. */
  notOnPhone?: string;
  /** More time than the 60 s a replay is given, for a demo whose steps are many or slow by their nature. */
  timeout?: number;
}

/** Each area's replays, by demo id. */
export type Replays = Record<string, DemoReplay>;

/** The hand for a page, and how many things a person sees it has checked so far. */
/**
 * A finger's pace: a person who taps a control and sees another come in its place reads it before tapping again, and no
 * one does that in under half a second — so two taps on one spot are this far apart, as a person's are (the viewer
 * takes a second tap sooner than that, on the same spot, for a double tap: steady-press.ts, 500 ms and 16 px).
 */
const RETAP_MS = 650;

export function handFor(page: Page, phone: boolean): { hand: Hand; seen: () => number } {
  let seen = 0;
  let lastTap = { at: 0, x: -100, y: -100 };
  const hand: Hand = {
    page,
    phone,
    mod: 'Control',
    async press(target, options = {}) {
      await target.scrollIntoViewIfNeeded();
      if (phone && !options.modifiers?.length) {
        const box = await target.boundingBox();
        const x = box ? box.x + (options.position?.x ?? box.width / 2) : -100;
        const y = box ? box.y + (options.position?.y ?? box.height / 2) : -100;
        const since = Date.now() - lastTap.at;
        // Within the viewer's 16 px, and a margin: a tap lands on whole pixels, the centres measured here are not.
        if (since < RETAP_MS && Math.hypot(x - lastTap.x, y - lastTap.y) <= 16 + 4) await page.waitForTimeout(RETAP_MS - since);
        await target.tap({ position: options.position });
        lastTap = { at: Date.now(), x, y };
      } else await target.click(options);
    },
    async type(target, words, options = {}) {
      await hand.press(target);
      if (options.clear) {
        await page.keyboard.press('ControlOrMeta+a');
        await page.keyboard.press('Backspace');
      }
      await page.keyboard.type(words, { delay: 15 });
    },
    async keys(...keys) {
      for (const key of keys) await page.keyboard.press(key);
    },
    async drag(from, to, options = {}) {
      await from.scrollIntoViewIfNeeded();
      const start = (await from.boundingBox())!;
      await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
      await page.mouse.down();
      const end = 'x' in to ? to : await (async () => {
        const box = (await to.boundingBox())!;
        return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      })();
      await page.mouse.move(end.x, end.y, { steps: options.steps ?? 12 });
      await page.mouse.up();
    },
    async pick(target, files) {
      const chooser = page.waitForEvent('filechooser');
      await hand.press(target);
      await (await chooser).setFiles(files);
    },
    async hover(target) {
      if (phone) throw new Error('a phone has no pointer to rest on a control: say why the step is not replayed on it (notOnPhone)');
      await target.hover();
    },
    async follow(words) {
      // The line under the demo's name shows the first step (folded under Options on a phone); the panel shows them all.
      const inLine = page.locator('.dh-try .dh-step-link').filter({ hasText: words }).first();
      if (await inLine.isVisible()) return hand.press(inLine);
      const panel = page.getByRole('complementary', { name: 'About this demo' });
      if (!(await panel.isVisible())) await hand.press(page.locator('.dh-help'));
      await hand.press(panel.locator('.dh-step-link').filter({ hasText: words }).first());
    },
    see(target, message) {
      seen++;
      return expect(target, message);
    },
    seePage(message) {
      seen++;
      return expect(page, message);
    },
    demo: <T>(path: string) => page.evaluate((read) => read.split('.').reduce((value: any, key) => value?.[key], (window as any).fieldiaDemo), path) as Promise<T>,
  };
  return { hand, seen: () => seen };
}
