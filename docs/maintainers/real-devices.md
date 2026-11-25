# Real phones, checked by hand at each minor

CI drives a phone as a browser engine at a phone's size: WebKit (Safari's engine) at an iPhone's 390 px with touch
for every demo's how-to (`e2e/how-to.spec.ts`, the `how-to-phone` project) and the smoke set's phone specs, and
Chromium at a phone's size with a phone's slower CPU for the perf gates. It never runs a real device: not iOS Safari
itself, its keyboard rising over the page and its zoom on a small box, its camera and microphone prompts, the one-time
code it offers from a text message, its pinch and its long press, its own way of going offline, or Chrome on a real
Android phone. Playwright cannot drive any of those (and its WebKit on Linux is not Safari).

From 0.37.0, each minor waits for a real iPhone and a real Android phone checked by hand; 0.36.0 was checked only by
CI's phones (WebKit iPhone 14 with touch, Chromium at a phone's size). The checklist came in 0.36.0, and no person
could check real phones for it, so the gate bites from 0.37.0 (`CHECKED_FROM` in `tools/real-devices.mjs`).

So a person runs the checklist below on a **real iPhone** and a **real Android phone** before each minor release from
0.37.0 (`0.x.0`), on the release candidate's demos — `https://fieldia.dev/demos/` once the candidate is deployed
there, or the built demos served on the local network (`node tools/serve.mjs dist/demos 4321`, opened at the machine's
address) — and records it at the end of this page. `node tools/release.mjs publish` and `tools/publish-packs.mjs`
refuse a minor with no row in the record that names it, its day, both phones, who checked and "passed"
(`tools/real-devices.mjs`, held by `tools/real-devices.test.mjs`). A patch holds fixes alone and is not asked for one.

Each phone as people have it: the newest iOS and its Safari, and an Android phone with the newest Chrome; light mode,
then the same screens again in dark mode where a step says so. Write down the model, the system's version and the
browser's version in the record. Anything wrong is a defect to fix before the release, with a screenshot — or, if it
can wait, "passed, …" with what was noted and where it is tracked.

## The checklist

On every screen, beside its own steps: nothing scrolls sideways; the keyboard never covers the box being typed in;
a tap lands on what was tapped (never on what slid under the finger); no box makes the page zoom in when it is
tapped; the words fit; light and dark both read.

1. **A record** — [Customer record](https://fieldia.dev/demos/plain/?page=customer&skin=underline). Type in Name; pick
   a Country from its list; press the flag beside Phone, type "jordan", pick it, type a number; press Block, then
   Block in its question, and Activate. Save with the bar's button. Then the same page in dark mode.
2. **Lines as cards** — [Sales order](https://fieldia.dev/demos/plain/?page=order&skin=underline). Add a line, pick a
   product, empty its Quantity and type 20: the totals follow; move the line up with its ↑. Open a line's dialog and
   close it.
3. **A list** — [Customer list](https://fieldia.dev/demos/plain/?page=customers&skin=underline): search, open the
   filters' sheet, turn one on, scroll to the end (the next rows come), open a customer and come back with the
   browser's Back.
4. **A form in steps** — [Product survey](https://fieldia.dev/demos/plain/?page=survey&skin=outlined): press Next
   with nothing typed (the words under the boxes), fill each step, send, read the ending.
5. **Days and hours** — [A flat let in Riyadh](https://fieldia.dev/demos/plain/?page=lease&skin=underline): open Ends
   on's calendar and pick a day; type a Hijri day; then in [a buyer's enquiry](https://fieldia.dev/demos/plain/?page=enquiry&skin=underline)
   set a follow-up's hour with the phone's own time wheel.
6. **Photos, camera and sound** — [Photos stored as they are picked](https://fieldia.dev/demos/plain/?page=listing-photos&skin=outlined):
   take a photo with the camera and pick two from the library; watch them upload. Then [a site visit's films and voice notes](https://fieldia.dev/demos/plain/?page=site-visit&record=1&skin=outlined):
   record a voice note (allow the microphone) and play it back. Then press Stop straight after Start: the dialog says
   nothing was recorded, never a note that cannot play; and record one of about 20 seconds: it plays back whole, from
   its first word, and its length is shown (0.36's recorder clock starts when the phone's recorder does). Then, on the
   Android phone (a mid-range one, not a flagship), in [a clinic's before and after](https://fieldia.dev/demos/plain/?page=clinic-before-after&skin=outlined):
   add a full-size photo from the library to After, press Crop and turn on it, turn it and press Apply. Judge the
   pause as the photo is added and as Apply closes the dialog: each should feel at once, and a second or more is a
   fail. From 0.37 a picture is encoded by the phone's own encoder, or at once after 0.2 s if that has not answered,
   holding the page for that encode.
7. **A code scanned** — [An injectable's lot](https://fieldia.dev/demos/plain/?page=clinic-treatment&record=1&skin=outlined):
   press Scan, allow the camera, scan a code from [the codes to scan](https://fieldia.dev/demos/samples/codes-to-scan.html)
   on another screen; then refuse the camera once and type the code instead.
8. **A map** — [Homes on a map](https://fieldia.dev/demos/plain/?page=map-homes&skin=outlined): pinch to zoom, tap a
   bubble, tap a pin (its card opens, its buttons all in view), fold and open the legend on
   [Orders by district](https://fieldia.dev/demos/plain/?page=map-zones&skin=outlined); draw an area with a finger on
   [An area on a map](https://fieldia.dev/demos/plain/?page=map-zone&skin=outlined).
9. **No signal** — [A viewing report with no signal](https://fieldia.dev/demos/plain/?page=viewing-report&skin=outlined):
   open it once online, turn on airplane mode, fill it in with a photo and send it ("Kept on this device"), close the
   tab, open the page again still in airplane mode (it opens, the send still waiting), turn airplane mode off: it is
   sent by itself.
10. **A signature, a code by text message, right to left** — [a consent](https://fieldia.dev/demos/plain/?page=clinic-consent&record=new&skin=outlined):
    sign with a finger; then [an enquiry from a broker's link](https://fieldia.dev/demos/plain/?page=unit-enquiry&skin=outlined):
    confirm a real mobile number by the code the phone offers from its text message (iOS: above the keyboard), and
    the payment step; then [the customer in Arabic](https://fieldia.dev/demos/plain/?page=customer&skin=underline&locale=ar&dir=rtl):
    everything right to left, typed Arabic read in its own direction.

## The record

One row per minor from 0.37.0, the newest first. "passed" or "passed, …" with what was noted; anything else holds the
release. 0.36.0 has none: it was checked only by CI's phones.

| Version | Day | iPhone | Android | Checked by | Result |
|---|---|---|---|---|---|
