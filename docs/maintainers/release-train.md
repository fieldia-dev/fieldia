# The release train

How Fieldia changes, so an app, a page and a test written against one version can plan for the next: what a patch may
hold, how often a minor comes, and how anything that is to change is said a minor before it does. The audit behind it:
R-H7 and R-H8 (October 2026) — 89 breaking changes in 8 days, three of them in patches, and no deprecation path.

Every rule here is held by a check that fails when it is broken; each says which.

## Versions

Before 1.0 every package releases together at one version, `0.minor.patch`.

- **A patch (0.36.1) holds fixes alone.** Nothing an app, a page or a test writes needs to change: its CHANGELOG
  section has no **Upgrading** part. npm's default range (`^0.36.0`) installs a patch by itself, so anything that
  changes DOM, wording, timing, defaults or types waits for the next minor.
  *Gate:* `tools/release-guards.mjs` (`patchProblem`) refuses to publish a patch whose section has an Upgrading part;
  `tools/release-guards.test.mjs` runs it on every pull request, against the three patches that broke this rule
  (0.26.1, 0.30.1, 0.31.1).
- **A minor comes every 2–4 weeks**, with the changes, each listed under its **Upgrading** part, grouped by who it
  touches: *page authors*, *app code*, *tests and CSS*, *self-hosters*. Fixes ship in patches between.
  *Gate:* from the train's first minor (0.37) `tools/release-train.mjs` refuses to publish a minor dated less than
  14 days after the minor before it, by their CHANGELOG headings. The four weeks are a target, not a check.

## Deprecations: a minor's warning first

Anything an app, a page or a test relies on that is to change or go — a page setting, an option, a member, an
attribute, a default, a DOM contract — is deprecated in one minor and changed in a later one, never in the same.

1. **Write it in the list**, `DEPRECATIONS` in `libs/core/src/lib/deprecations.ts`: its id (`viewer.mount-throws`),
   `since` (the minor that first warns of it), `changesIn` (a later minor), who it touches, what changes and what to
   write instead, and how it is said (`warns`).
2. **Say it where it is used.** Where a use of it can be seen as Fieldia runs — the setting given, the member called,
   the default relied on — that code calls `deprecated(id, words, changesIn)` from `@fieldia/core`: the console says
   it once in a page (however many copies of Fieldia the page carries), with the minor it changes in and a link to
   fieldia.dev/promises/#deprecations. A use of what stays never warns. Where no use can be seen — a class name, the
   order of a part's elements — `warns` is `"changelog"`, and the CHANGELOG alone says it.
3. **List it under Deprecated** in the CHANGELOG section of its `since` minor, by its id, with what to write instead.
4. **Change it in its `changesIn` minor**, whose Upgrading item cites it: `(deprecated in 0.37: \`viewer.mount-throws\`)`.
   Then mark it changed (`changed: true`): its `deprecated()` call goes — the change is made, nothing is warned of —
   and it stays on the list, so that minor's citation of it is checked for good (0.37 first changed two: `page.invalid`
   and `format.under-stamped`).

From the train's first minor (0.37), every item of a minor's Upgrading part says what it is:

| Tag | What it is |
| --- | --- |
| `(adds)` | Something new an app, a test or a fake may have to follow: a label key, a member of an interface, a part file to serve. Nothing that worked stops working. |
| `(fix)` | Fieldia made to do what its docs already said. A fix of something wrong never waits for a deprecation. |
| `(deprecated in 0.N: \`id\`)` | A change that was deprecated in minor 0.N, whose list entry says it changes in this minor. |

*Gates:*
- `tools/release-train.mjs` (`trainProblems`), run by `release.mjs check` (it warns) and by `release.mjs publish` and
  the publish workflow's `tools/publish-packs.mjs` (they refuse): an Upgrading item with none of the three tags; a
  citation of an id the list does not have, or whose `changesIn` is another minor, or whose `since` is this minor; a
  list entry that changes in this minor and is not cited; a list entry first warned of in this minor and not under
  **Deprecated**; a malformed entry (an id twice, a `changesIn` not after `since`, a `changed` that is not `true`).
- `tools/release-train.test.mjs`, on every pull request: those refusals, each shown to bite; the real CHANGELOG and
  list keep the train for every minor; and every `deprecated(…)` call in the packages names an entry with its
  `changesIn` and not changed, while every entry said in the console and not changed has a call.
- `libs/core/src/lib/deprecations.spec.ts`: a deprecated use warns once in a page; every example page checked,
  validated and made a form says nothing of a deprecation.

**What is a DOM change.** Anything an app's tests or CSS can reach: a role, an accessible name, a `.fd-*` class, a
`data-*` attribute, where an element sits among its part's. `@fieldia/testing` finds what a person finds — by roles
and labels — and is the surface tests should use; it is kept working across minors.

## The page format

A page says the format it is written in (`"fieldia": "0.13"`), and every later Fieldia reads it.

- **Formats only add.** A setting is never renamed, reshaped or removed in place: a release that must do so makes a
  new format with a step in `PAGE_UPGRADES` that rewrites an older page, and its example.
  *Gate:* `tools/format-shape.mjs` (run by `release.mjs`) refuses a format whose shape changed under its version;
  `upgrade.spec.ts` runs every step on its example.
- **A page is written in the lowest format its settings need**, so an older Fieldia that knows every setting a page
  uses reads it (see the format's docs, "Versions"): the designer publishes so, and `stampPage` stamps so. And a page
  is read by its stamp: one that says an older format than a setting it uses came in is warned of in 0.36 and refused
  from 0.37 — the train's first deprecation, `format.under-stamped`.
  *Gate:* `tools/format-since.test.mjs` — every example page stamped with `lowestFormat` is read by that format's own
  schema as it was released (and not by the format before), and so is every example page of every format released,
  as it was written then; `tools/format-since.json`, the format each place came in, is what the history says.
  `stamp.spec.ts`: a page using nothing new is read by 0.30's format check (copied from its release, and held to it),
  a `secret` stamps 0.13, a page stamped lower than it needs is warned of by both checks.
- **A default that changes is a new format.** A page written in an older format keeps its old behaviour — the new
  format's step writes the old default into it, and says which pages rely on the new one (`PageUpgrade.uses`), which
  `lowestFormat` then stamps with it. The defaults that changed before the train are listed with the setting that
  keeps the old way (`DEFAULT_CHANGES`, on the format's docs page).
  *Gate:* `default-changes.spec.ts` — each listed setting reads in both checks and needs no later format than the
  default's; `stamp.spec.ts` — a step that says a page relies on it stamps the page with its format.

## The checks a viewer runs: said in 0.36, refused from 0.37

0.36 brought the whole check of a page to the browser: `validatePage`'s verdict without zod (`checkPageWhole`), held
to it by `shape-parity.spec.ts`. Refusing every page it refuses at once would stop pages 0.35 drew — a list's
`pageSize` past 500, a key the format does not have, its least more than its most — with no warning first. So the
train's own rule applies to it, the deprecation `page.invalid`:

- **0.36.** Before the draw a viewer ran `checkPage`, what 0.35's viewer refused, and a page it refused was not drawn:
  its words were where the form would be. The whole check was a part of its own, asked for once the page was drawn
  and the browser idle; what only it found was said once in the console and to `onError` (`stage: "check"`,
  `warning: true`), and the page stayed drawn. `fieldia.js` was 197.0 KB gzipped at 0.36.0, under the owner's 200.
- **0.37, built** (the coordinator's decision of 28 Oct, after measuring the check before the draw on Slow 4G: every
  valid page drew 0.1–0.8 s later, paying for authors' mistakes that `validatePage` finds where pages are made). The
  whole check is a part of its own in an app's bundle too (in the one-tag script `fieldia.check.js`), asked for once
  nothing a page is drawn from is still on its way (`askForCheck`: the one-tag script once the page is parsed, a viewer
  waiting for its parts once it is drawn) — beside the app's own data, never beside a page's parts, whose bytes it would
  share a slow line with — and run as soon as the page is drawn and painted: no page waits for it, and a valid page draws
  as 0.36 drew it. It is no part a page is drawn from, so `partFiles` and `partTags` name it no more: a tag for it would
  share the line with `fieldia.js` itself. A page it refuses is taken down: its form
  replaced by why, `onError` told (`stage: "check"`; what 0.35 refused stays `"draw"`, thrown at the mount), the
  viewer's `refused` settled with the `PageRefused`. And nothing is written through a page before it ran: every write
  the page makes through its data source — a save, a send, a step's save, an upload, the outbox's send, a draft on the
  server, a payment, a code sent — waits for it (held-writes.ts), and is refused with the page. 0.37's Upgrading part
  cites `page.invalid` and `format.under-stamped`, marked changed.
  *Gates:* `refused.spec.ts`, the bindings' specs, `e2e/page-check.spec.ts` (three engines, four frameworks: a send
  held, then sent or refused), the script bundle's in-page checks, and the Slow 4G table against 0.36.0
  (docs/promises.md, measured by hand).
- **When the whole check's part cannot come** (the network refuses it, or its bytes are not those it was built with),
  the page stays drawn — the checks the main script carries passed: the outline, every name, condition and
  expression, and every safety check (addresses through `safeUrl`, files shown by their bytes, the bounds of what a page
  or a person can make Fieldia do) — and it is said once in the console and to `onError` (a warning) that the page could
  not be fully checked, and over the page as any part that could not load, with its reload; the writes held for it go
  on. Why: what only the whole check finds is an author's mistake, which `validatePage`, `npx fieldia-check` and the
  designer find where pages are made; an availability failure — a CDN's bad minute — must not take every form down.
  *Gates:* `e2e/part-failures.spec.ts` (the `check` part, both ways it fails, three engines), `e2e/page-check.spec.ts`
  ("its check could not come"), docs/promises.md.

## Releasing

How a release reaches npm, and what refuses one that is not ready: [publishing.md](publishing.md).
