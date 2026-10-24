# Publishing Fieldia

How a release of the fifteen `@fieldia/*` packages reaches npm, what refuses a release that is not ready, and the
owner's checklist for switching npm to trusted publishing. The audits behind it: S-H3, S-H4, S-H5, S-M8, S-L10–L12
and R-H7, R-H9, R-M15 (October 2026).

## What a release is

A release is one commit, already merged and pushed to `main` and green in CI, tagged with its version:
`v0.34.0`. Every package releases together at that version. Before anything is published,
`tools/release-guards.mjs` refuses, in words that say what to do:

- a working tree with changes, or with files git does not track;
- a HEAD that is not on `origin/main` (as last fetched: `git fetch origin` first);
- a HEAD without the tag `v<version>` — the tag is made first, and the publish follows it;
- a patch version (`0.x.y`, y > 0) whose CHANGELOG section has an **Upgrading** part. A patch holds fixes alone:
  npm's default range (`^0.34.0`) installs it by itself, so nothing an app, a page or a test writes may change in it.
  Anything that changes DOM, wording, timing, defaults or types waits for the next minor.

`node tools/release.mjs check` packs every package, installs the packs into an empty project with no install
scripts and no npm token, imports them, type-checks them, runs the script bundle and its parts, and runs `npm audit`
over what an app installs (high or critical refused; a reviewed exception lives in `tools/audit-allowed.json` with
its reason and an end date). It refuses a pack with a file that names a path on the machine it was built on
(`/home/…`, `/Users/…`: source maps carry relative paths alone), and a `@fieldia/viewer` whose README's script tags
are not its own version's with its own files' hashes. It leaves the packs in `tmp/release/packs/` with `packs.json`
— their publishing order, dependencies first, and the sha512 each was packed with. Whatever publishes them checks
each tarball against it (`tools/release-publish.mjs`): what is published is what was checked.

## Publishing from CI (once npm is switched over)

`.github/workflows/publish.yml`, on a pushed `v*` tag:

1. **build** — a clean runner, `npm ci` from the lockfile with no cache, every package built, `release.mjs check`;
   read access alone. It uploads the packs.
2. **publish** — in the `npm` environment, with `id-token: write`: npm asks GitHub for a short-lived OIDC token for
   this run and trades it for the publish (npm's trusted publishing). No `npm ci`, no build: only node and npm run
   where the token can be had. `tools/publish-packs.mjs` checks the guards above, that the tag is the packages'
   version, the packs' hashes and commit, npm ≥ 11.5.1, then runs `npm publish --provenance` per package, in order.
   A package already on npm at this version is left; a failure stops there and says what is on npm and what is
   not — run the job again and it takes the rest.
3. **verify** — `release.mjs verify`: the same checks on what npm serves, and the script tags' hashes recorded from
   it (below), uploaded as the run's `script-tags` artifact.

There is no npm token anywhere: not in a secret, not in the workflow. Until the packages trust this workflow on
npmjs.com, npm refuses the publish job — nothing can be published from CI before the switch.

**To release:**

```sh
git switch main && git pull                  # the release commit, merged, pushed, CI green
git tag -a v0.34.0 -m "Fieldia 0.34.0"
git push origin v0.34.0                      # starts Publish; approve its npm environment when asked
node tools/release-notes.mjs 0.34.0          # once it is on npm: the GitHub release's command and its notes
```

Then commit what the verify job records (below), so fieldia.dev's and the READMEs' script tags name the new version.

**The dry run.** Actions → Publish → Run workflow, on any branch, with *dry run* ticked (the default): `build` as on a
tag, then everything `publish` does with `npm publish --dry-run` and no OIDC token. Nothing is published; the log
says what a real run would refuse (on a branch: the missing tag, at least) and which packages it would publish.
Unticking *dry run* fails the run with words: a real publish runs only from a pushed tag. The same, on a machine:

```sh
npx nx run-many -t build && node tools/release.mjs check
node tools/publish-packs.mjs tmp/release/packs --dry-run
```

## Publishing from a maintainer's machine (until the switch)

While the packages still accept a token, a release can be published locally — guarded the same way:

```sh
git tag -a v0.34.0 -m "Fieldia 0.34.0"
npx nx run-many -t build
NPM_TOKEN=… node tools/release.mjs publish   # the guards, the check, then npm publish of the checked packs
```

The token is read from the environment, written only as a reference in a throwaway npmrc under `tmp/`, and handed
to `npm publish` alone: no check, install, `node` or `tsc` run sees it. Use a granular token scoped to `@fieldia/*`,
with a short expiry, kept in a keyring — never pasted into a chat or a file. Once every package is on npm it prints
the version's notes and the commands that push its tag and make its GitHub release. Pushing the tag starts the
publish workflow too: it finds every package on npm and publishes nothing.

After "Require two-factor authentication and disallow tokens" (below), a token cannot publish: this path ends, by
design.

## After a release

- `node tools/release.mjs verify` installs the version from npm and checks it as `check` checks the packs. It also
  records, in `tools/script-tags.json`, the sha384 of every file of `@fieldia/viewer/bundle/` as npm serves it, and
  writes the READMEs' script tags from it (`tools/script-tags.mjs`). Commit both: fieldia.dev's snippets and the
  READMEs name a version only once it is on npm, with the hash of the file npm serves. The publish workflow's verify
  job uploads both as its `script-tags` artifact. For a version published before this (0.32, 0.33), whose own README
  has no such tags for verify to check, `node tools/script-tags.mjs record 0.33.0` records it alone.
- The README inside `@fieldia/viewer` is written as the package is built, with that version's own hashes — the files
  beside it in the same tarball, which jsDelivr serves for it — and `release.mjs check` refuses a pack whose README
  says otherwise.
- `npm audit signatures` in any project that installs `@fieldia/*` verifies the provenance of versions published
  from CI; npm's page for the version shows "Provenance" with a link to the commit and the run.

## The owner's checklist: switching npm to trusted publishing

One sitting, in this order. Nothing in it changes code; each step is on GitHub or npmjs.com.

**On GitHub (github.com/fieldia-dev/fieldia → Settings)**

1. **Environments → New environment `npm`.** Required reviewers: yourself (and the second maintainer, step 9).
   Deployment branches and tags: *Selected branches and tags* → add the tag rule `v*`. Every publish then waits for
   a reviewer's approval, and only from a version tag.
2. **Rules → Rulesets → New tag ruleset**, target `v*`, enforcement *Active*: restrict creations, updates and
   deletions, bypass list *Repository admin* alone. Only a maintainer can make a version tag, and none can move one.
3. **Actions → Publish → Run workflow** on `main`, *dry run* ticked. It must end green, with every package "would
   publish" (or "already on npm") and, as refusals, nothing but the missing tag.

**On npmjs.com, for each of the 15 packages** — `@fieldia/core`, `widgets`, `viewer`, `grid`, `code`, `monaco`, `map`,
`calendar`, `gantt`, `chatter`, `react`, `vue`, `angular`, `designer`, `testing` (npmjs.com/package/@fieldia/core →
Settings):

4. **Trusted publishing → GitHub Actions:** organization or user `fieldia-dev`, repository `fieldia`, workflow
   filename `publish.yml`, environment `npm` → *Set up connection*.
5. **Publishing access → "Require two-factor authentication and disallow tokens"** → *Update package settings*.
   Trusted publishing still works; no token, old or new, can publish.

**On your npm account and the `fieldia` organization**

6. **Two-factor authentication with a security key** (WebAuthn) for authorization and writes; and in the
   organization, *Require two-factor authentication* for every member.
7. **Revoke every access token** (Access Tokens → each one → Delete), classic and granular, the one used for the
   0.3x releases first — it has been in chat transcripts. Remove `NPM_TOKEN` from shell profiles, keyrings and any
   `~/.npmrc` on the development machines.

**People**

8. **A second maintainer** with 2FA: an owner of the `fieldia` npm organization and a maintainer of the GitHub
   repository — so a lost account or key never stops a security fix.
9. Add them as a required reviewer of the `npm` environment (step 1).

**The first release from CI**

10. Tag and push the next release (*To release*, above), approve the `npm` environment, and check on npm that each
    package's new version shows *Provenance*. Commit what `verify` records. From then on, every release is a tag.
