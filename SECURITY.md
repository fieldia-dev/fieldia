# Security

## Reporting a vulnerability

Please report it privately, through GitHub's form for this repository:
**https://github.com/fieldia-dev/fieldia/security/advisories/new**. Do not open a public issue, a pull request or a
discussion for it.

Say what you found and where (the package and version, or the page of fieldia.dev), how to reproduce it — a page JSON,
a record value or a few lines of code is ideal — and what someone could do with it. If you have a fix in mind, describe
it in the report rather than in a public pull request.

What happens next:

- We answer within 5 working days to say we have it, and tell you what we found once we have reproduced it.
- We work on the fix in a private fork of the advisory, release it, and publish the advisory with the versions it
  affects and the version that fixes it. You are credited, unless you ask not to be.
- **Disclosure: 90 days.** We aim to release a fix well within 90 days of your report. After 90 days you are free to
  publish what you found, fixed or not; if a fix is out sooner, the advisory is published with it. If something is
  being exploited, tell us so — we then release as soon as a fix is ready, and you may say so publicly at once.

## Supported versions

Fieldia is before 1.0 and releases often (see [CHANGELOG.md](CHANGELOG.md)). A security fix ships in a release of the
latest minor version, as a patch (0.x.**y**), which changes nothing an app, a page or a test writes.

| Version                          | Security fixes            |
| -------------------------------- | ------------------------- |
| The latest minor (0.x, newest)   | Yes                       |
| Any older minor                  | No — upgrade to the latest |

From 1.0, the stability promise will name the lines that get security fixes and for how long.

## What is in scope

- The packages on npm: `@fieldia/core`, `widgets`, `viewer` (and its script bundle, `bundle/fieldia*.js`), `grid`,
  `code`, `monaco`, `map`, `calendar`, `gantt`, `chatter`, `react`, `vue`, `angular`, `designer`, `testing`.
- fieldia.dev and its demos.
- How Fieldia is released: the workflows in `.github/`, `tools/release.mjs`, the script tags the docs print.

A page is data: Fieldia draws it and never runs code from a page or a record value. What a form checks in the browser
is a convenience for the person filling it in; your server is the final gate — it re-checks what is sent, decides
who may see and change what, and works out amounts to pay. A form that lets someone send what your server then
accepts is a report for your server; a page or a value that makes Fieldia run script, leak data to another origin, or
lose what was typed is a report for us.

## The security model

What Fieldia guarantees, each guarantee with the test that holds it, is on
[What Fieldia promises](docs/promises.md) (also at fieldia.dev/promises). In short:

- **In the browser, Fieldia guarantees:** no code made from text, under a strict Content-Security-Policy; no request
  of its own; every address through `safeUrl`; rich text and Markdown sanitized; a file shown in place only as what
  its bytes are; CSV cells a spreadsheet would run kept as words; bounds on patterns, dates, values worked out,
  imports and archives; a framed form that talks only to the sites it names; each part of the one-tag script checked
  against its hash, and a send a part must check never made without it; drafts kept per person, secrets never in
  them; a page the checks refuse never drawn.
- **Your server must still:** check what it is sent with `checkSubmission(page, values, context)` — required fields,
  patterns, options, codes proved, the payment due; decide who may see and change what (a field hidden or read-only
  in the browser is not protected); check a code's proof and a payment's reference itself; and store only pages that
  pass `validatePage`.
- **Not bounded:** the time a page's own conditions and computed values take. Check a page from an author you do not
  trust before you store it.

A guarantee that does not hold is a vulnerability: report it as above.

## How releases can be checked

- A version published from this repository's GitHub Actions, on its version tag, carries npm provenance:
  `npm audit signatures` verifies it, and npm's page for the version links the commit and the workflow run that built
  it. A version with none was published from a maintainer's machine, as every version was until publishing moved to
  CI ([docs/maintainers/publishing.md](docs/maintainers/publishing.md)).
- The script tags in the docs name an exact version and carry its `integrity` hash; and from 0.34 `fieldia.js` checks
  each part it loads against the hash it was built with, so a file that is not the one released is refused by the
  browser.
