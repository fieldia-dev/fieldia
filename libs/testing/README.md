# @fieldia/testing

Test the [Fieldia](https://fieldia.dev) forms in your app **as people use them**: find a field by the words of its
label, type in it and leave it, pick from a list, tick a box, press a button by its words — then read back what a person
sees: a field's problems, its warnings, what its box shows. The same helpers for **Testing Library** (any DOM: jsdom or
happy-dom under Jest or Vitest, or a browser) and for **Playwright**. And **`fieldia-check`**, one line of CI that keeps
the pages your app stores valid after an upgrade.

```sh
npm install --save-dev @fieldia/testing
```

## With Testing Library (Jest, Vitest)

```ts
import { mountViewer } from '@fieldia/viewer';
import { fieldia } from '@fieldia/testing';

test('a sign-up says what is missing', async () => {
  const host = document.body.appendChild(document.createElement('div'));
  const handle = mountViewer(host, { page, dataSource });
  await handle.drawn; // the page drawn, every part it draws from in

  const form = fieldia(host);
  await form.fill('Email', 'mona@');
  expect(form.errorsOf('Email')).toEqual(['Enter an email address, like name@example.com']);
  await form.fill('Email', 'mona@example.com');
  await form.pick('Country', 'Egypt');
  await form.check('I agree to the terms');
  await form.press('Submit');
  expect(form.valueOf('Email')).toBe('mona@example.com');
});
```

Each step sends the events a person's would — focus, `beforeinput` for each key (so a box that refuses a key, a letter
in a number, refuses it here too), `input`, `change`, then leaving the box, where Fieldia says a problem — and waits a
turn of the event loop for the form. No dependency on any testing library: with `@testing-library/user-event`, hand it
the box instead: `await user.type(form.box('Email'), 'mona@example.com')`. Under fake timers, tell the helpers how to
wait: `fieldia(host, { settle: () => jest.advanceTimersByTimeAsync(0) })`.

| Helper | What it does |
| --- | --- |
| `field(ref)` | The field's element (`.fd-field`). Throws, naming the fields shown, when none or several match. |
| `box(ref)` | The box a person types in or picks with. |
| `fill(ref, text)` | Types `text` in place of what the box held, a key at a time, and leaves it. |
| `pick(ref, ...options)` | Chooses by their words: a list's option, a radio, exactly these boxes among several, an option of Fieldia's own list or a link's record (typed, then pressed once it shows). |
| `check(ref, on = true)` | Ticks or unticks a yes-or-no box or switch. |
| `press(name)` | Presses a button by its words or its name for a screen reader (`Save`, `Submit`, `Add a line`). |
| `errorsOf(ref)` / `warningsOf(ref)` | The problems / warnings the field says, each in its words. |
| `valueOf(ref)` | What its box shows: its text; a choice's words (`null` for none); the words of each box ticked among several; `true`/`false` for one box. Never the stored value — read that from `handle.form.getState().values`. |
| `read(ref)` | All of it at once: `{ label, value, errors, warnings }`. |
| `labels()` | The words of every field's label shown. |

A field is named by its label's words as people read them — without its required mark, its (?) or its lock — or, where
two fields share a label, by its field: `{ field: 'email' }`. `fieldia(root)` takes the element the viewer was mounted in,
or a dialog, or the whole document by default.

## With Playwright

```ts
import { expect, test } from '@playwright/test';
import { fieldia } from '@fieldia/testing/playwright';

test('a refused save lands on its field', async ({ page }) => {
  await page.goto('/customers/42');
  const form = fieldia(page); // or a dialog: fieldia(page.getByRole('dialog'))
  await form.fill('Phone', '+20 2 1111 2222');
  await form.press('Save');
  await expect(await form.error('Email')).toHaveText('This email is already a customer’s');
  await expect.poll(() => form.valueOf('Phone')).toBe('+20 2 1111 2222');
});
```

The same helpers, each step Playwright's own (`fill`, `selectOption`, `check`, `click`), so they wait as Playwright
waits; `field`, `box` and `error` give locators for `expect`. A read (`errorsOf`, `valueOf`) is the moment's: wrap it in
`expect.poll`. `@playwright/test` is an optional peer: the helpers take its types only.

## `fieldia-check` in CI

```sh
npx fieldia-check pages/                       # every .json in pages/ and the folders in it
npx fieldia-check pages/ --functions vat,fx     # the names of your app's own functions its pages call
npx fieldia-check pages/ --strict               # warnings fail too
```

Each page is checked as Fieldia reads it — `validatePage`: the format's shape, every field a layout names, every
expression and what it calls — and its warnings said. It prints a ✓ or ✗ for each file with what is wrong, indented,
and exits 1 when one is refused (2 when asked wrongly). A page saved by an older Fieldia is read as Fieldia reads it, so
the check after an upgrade says whether your stored pages still draw. In code: `checkPageFiles(pageFiles(['pages/']))`
from `@fieldia/testing/pages`.

## License

MIT
