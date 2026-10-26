# The key screens, compared with stored images

`e2e/screens.spec.ts` shoots the screens a person meets first and compares each with its image in
`e2e/screens-baseline/`: a customer's record in light and dark and in each of the three looks (underline, outlined,
quiet), the same record on a phone and right to left in Arabic, a list, and a form in steps on a phone in dark mode.
Only the demo is shot, never the frame round it (whose header follows the catalogue's words). The clock is held
(`page.clock.setFixedTime`: what is "today", "overdue", "2 hours ago"), the zone and the language are named, motion is
off and the caret hidden, so the same code draws the same pixels.

## Where they run

In the Playwright container alone — `tools/screens.mjs` names it by its digest, and CI's **Key screens** job runs in
the same image (`tools/workflows.test.mjs` holds the two to one image, of the Playwright version `package.json`
installs). The same browser build and the same fonts wherever it runs, so a difference is Fieldia's, never a machine's
fonts. Outside the container the spec skips itself with words saying so; in CI it refuses to compare anywhere else.

A screen passes within a small tolerance (`maxDiffPixelRatio: 0.002` in `playwright.config.ts`, the `screens`
project): anti-aliasing at an edge, never a moved box or a changed colour.

## When CI says a screen differs

The job's artifact (`screens-compared`) holds, for each screen that differs, the expected image, the actual one and
the difference. Look at all three.

- **A change you meant** (a new look, a moved field, new words): store the screens again, below, and commit the new
  images with the change. The pull request shows them side by side for review.
- **A change you did not mean**: that is a defect the screens caught. Fix it; never store the image again to make the
  job green.
- **A difference that comes and goes** (the flake log in the job's summary says so: it differed, then passed on the
  same commit): the page does not settle — a font or a picture that comes late, something still moving, a value read
  from the clock that the held clock misses. Find which and fix the page or the test. Never raise the tolerance to
  hide it.

## Comparing, and storing them again, on your machine

Docker, and the plain demo built (once after a change):

```sh
node tools/build-demos.mjs plain       # or every demo: node tools/build-demos.mjs
node tools/screens.mjs                 # compare: a difference fails, its images in test-results/screens-run/
node tools/screens.mjs --update        # store every screen again, in e2e/screens-baseline/
node tools/screens.mjs --update -g record-quiet   # or only those whose name matches
```

`tools/screens.mjs` mounts the workspace (and the install its `node_modules` links to) at the same path in the
container, runs as your own user, and serves the demo on port 6795 (`FIELDIA_SCREENS_PORT` to change it).

## Adding a screen

Keep the set small: each image is about 100 KB, stored in git for good. A screen earns its place when it is a look many
people meet first and no other screen shows it. Add it to `SCREENS` in `e2e/screens.spec.ts`, store it with
`node tools/screens.mjs --update -g <its name>`, look at the image, and commit both.

## Moving Playwright to a new version

The container is Playwright's own image for one version. When `@playwright/test` moves in `package.json`, move the
image in `tools/screens.mjs` and in `.github/workflows/ci.yml`'s screens job to the new version's image, by its
digest (`docker pull mcr.microsoft.com/playwright:v<version>-noble`, then
`docker inspect --format '{{index .RepoDigests 0}}' mcr.microsoft.com/playwright:v<version>-noble`), store every
screen again, and look at what changed: a new browser draws some pixels its own way.
