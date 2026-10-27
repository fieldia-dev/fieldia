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
   Then take it off the list.

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
  **Deprecated**; a malformed entry (an id twice, a `changesIn` not after `since`).
- `tools/release-train.test.mjs`, on every pull request: those refusals, each shown to bite; the real CHANGELOG and
  list keep the train for every minor; and every `deprecated(…)` call in the packages names an entry with its
  `changesIn`, while every entry said in the console has a call.
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

- **0.36.** Before the draw a viewer runs `checkPage`, what 0.35's viewer refused, and a page it refuses is not drawn:
  its words are where the form would be. The whole check is a part of its own (`fieldia.check.js`, a chunk in an app's
  bundle), asked for once the page is drawn and the browser idle, never delaying the draw. What only it finds is said
  once in the console and to `onError` (`stage: "check"`, `warning: true`), and the page stays drawn. A part that
  cannot come says nothing. `fieldia.js` stays at 191.2 KB gzipped.
  *Gates:* `refused.spec.ts` (a page 0.35 drew is drawn and said once; one it refused is refused with the words),
  `shape-parity.spec.ts` (the check before the draw refuses nothing the whole check passes), the script bundle's
  in-page check (the part never asked for before the draw, a mistake said after it).
- **0.37, the plan, not built.** The check part is asked for as the script starts, in parallel with the page's other
  parts, and listed by `partFiles`, so a page's part tags and preload links carry it. The viewer waits for it as it
  waits for the page's parts, then refuses what it finds before the first draw, as the check before the draw does.
  `fieldia.js` keeps its size; the part's 17 KB comes beside the page's parts, not after them. Decide before 0.37 what a
  page does when the check part cannot come: refuse it, as a send a part must check is refused, or draw it on the
  check before the draw alone. 0.37's Upgrading part cites `page.invalid`, and `tools/release-train.mjs` refuses 0.37
  if it does not.

## Releasing

How a release reaches npm, and what refuses one that is not ready: [publishing.md](publishing.md).
