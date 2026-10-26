import type { Locator, Page } from '@playwright/test';
import { expect } from '../../fixtures';
import { node } from './support-more';
import type { DemoReplay } from '../hand';

/**
 * The browser's microphone and camera, stood in for as e2e/media.spec.ts stands them in — a tone, and a picture that
 * changes colour, each engine's own MediaRecorder recording them — or refused, as a person who says no in the browser's
 * question. A test machine has neither, and Playwright answers no question; the recorder asks for them as it opens.
 */
async function devices(page: Page, how: 'allow' | 'refuse') {
  await page.evaluate((refuse) => {
    const getUserMedia = async (constraints: MediaStreamConstraints) => {
      if (refuse) throw new DOMException('Permission denied', 'NotAllowedError');
      const audio = new AudioContext();
      const tone = audio.createOscillator();
      const out = audio.createMediaStreamDestination();
      tone.connect(out);
      tone.start();
      const tracks: MediaStreamTrack[] = [...out.stream.getAudioTracks()];
      if (constraints.video) {
        const canvas = Object.assign(document.createElement('canvas'), { width: 320, height: 240 });
        const context = canvas.getContext('2d') as CanvasRenderingContext2D;
        let step = 0;
        setInterval(() => {
          context.fillStyle = `hsl(${(step++ * 12) % 360} 60% 50%)`;
          context.fillRect(0, 0, 320, 240);
        }, 40);
        tracks.push(...canvas.captureStream(25).getVideoTracks());
      }
      return new MediaStream(tracks);
    };
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
  }, how === 'refuse');
}
/** A film's or a sound's player, as it stands: paused or playing, and how far into it. */
const playing = (media: Locator) => media.evaluate((element: HTMLMediaElement) => ({ paused: element.paused, time: element.currentTime }));
/** Playwright's WebKit has no MediaRecorder, so no Record button is offered there; an iPhone's Safari has one. */
const NO_RECORDER = 'Playwright’s WebKit has no MediaRecorder, so the page offers no Record button there (an iPhone’s Safari records)';

/** The site-visit demo’s how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  timeout: 150_000,
  steps: [
    {
      says: 'Look at the Video tour: Living room shows the poster frame',
      async run({ page, see }) {
        const cards = node(page, 'f-tour').locator('.fd-file-item');
        await see(cards).toHaveCount(2);
        await see(cards.nth(0)).toContainText('Living room.webm');
        await see(cards.nth(1)).toContainText('webm');
        // Living room: the store's poster frame, a picture; Walk-through: its own frame, drawn by the browser.
        const poster = cards.nth(0).locator('.fd-file-film img');
        await see(poster).toBeVisible();
        await expect.poll(() => poster.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth)).toBe(480);
        const own = cards.nth(1).locator('.fd-file-film video');
        await see(own).toBeVisible();
        await expect.poll(() => own.evaluate((film: HTMLVideoElement) => film.readyState >= 2 && film.videoWidth)).toBe(480);
        // Each under a play mark.
        await see(node(page, 'f-tour').locator('.fd-file-film')).toHaveCount(2);
        for (const film of await node(page, 'f-tour').locator('.fd-file-film').all()) expect(await film.evaluate((frame) => getComputedStyle(frame, '::after').content)).not.toBe('none');
      },
    },
    {
      says: 'Open Living room: it plays in the dialog, starting from its poster frame',
      async run({ page, press, keys, phone, see }) {
        await press(node(page, 'f-tour').getByRole('button', { name: /^Living room\.webm, / }));
        const dialog = page.getByRole('dialog', { name: 'Living room.webm' });
        await see(dialog).toBeVisible();
        const film = dialog.locator('video');
        // From its poster frame: the store's picture, the film at its start.
        await see(film).toHaveAttribute('poster', '../samples/tour-poster.jpg');
        expect(await playing(film)).toEqual({ paused: true, time: 0 });
        // Pressed, it plays there.
        await press(film);
        await expect.poll(async () => (await playing(film)).time).toBeGreaterThan(0.1);
        if (phone) return; // the arrow keys are a keyboard's: a phone has none
        // The player's own arrows: paused, ArrowRight moves the film on; the dialog stays on it.
        await keys('Space');
        await expect.poll(async () => (await playing(film)).paused).toBe(true);
        const at = (await playing(film)).time;
        await see(film).toBeFocused();
        await keys('ArrowRight');
        await expect.poll(async () => (await playing(film)).time).toBeGreaterThan(at);
        await see(dialog).toBeVisible();
        // Elsewhere in the dialog, the arrow goes to the next file.
        await press(dialog.getByRole('heading', { name: 'Living room.webm' }));
        await keys('ArrowRight');
        await see(page.getByRole('dialog', { name: 'Walk-through.webm' })).toBeVisible();
        await keys('Escape');
        await see(page.getByRole('dialog')).toHaveCount(0);
      },
    },
    {
      says: 'Press play on Kitchen and balcony under Voice notes',
      async run({ page, press, phone, see }) {
        // The phone's dialog is still open: closed by its ×.
        if (phone) await press(page.getByRole('dialog').getByRole('button', { name: 'Close' }));
        await see(page.getByRole('dialog')).toHaveCount(0);
        const note = node(page, 'f-voice').getByRole('listitem').filter({ hasText: 'Kitchen and bal' }).locator('audio');
        await see(note).toHaveAccessibleName('Kitchen and balcony.webm');
        // The player's play button, at its left end.
        await note.scrollIntoViewIfNeeded();
        const box = (await note.boundingBox())!;
        await press(note, { position: { x: 20, y: box.height / 2 } });
        await expect.poll(async () => (await playing(note)).time).toBeGreaterThan(0.2);
        // Where it is: in the list, no dialog opened for it.
        await see(page.getByRole('dialog')).toHaveCount(0);
        await see(note).toBeVisible();
      },
    },
    {
      says: 'Press Record a voice note and allow the microphone',
      notOnPhone: NO_RECORDER,
      async run({ page, press, see }) {
        await devices(page, 'allow');
        const voice = node(page, 'f-voice');
        await press(voice.getByRole('button', { name: 'Record a voice note' }));
        const dialog = page.getByRole('dialog', { name: 'Record a voice note' });
        await see(dialog.getByRole('status')).toHaveText('Ready. Press Start recording.');
        await press(dialog.getByRole('button', { name: 'Start recording' }));
        await see(dialog.getByRole('status')).toHaveText('Recording…');
        // A few words: a second or two of the microphone, its timer counting.
        await see(dialog.getByRole('timer')).toHaveText(/^0:0[2-9] \/ 2:00$/, { timeout: 15_000 });
        await press(dialog.getByRole('button', { name: 'Stop' }));
        await see(dialog.getByRole('status')).toHaveText(/^Recorded 0:0\d\. Play it back, then use it or record again\.$/);
        // Played back where it is in the recorder.
        const back = dialog.locator('.fd-recorder-review audio');
        await see(back).toBeVisible();
        const box = (await back.boundingBox())!;
        await press(back, { position: { x: 20, y: box.height / 2 } });
        await expect.poll(async () => (await playing(back)).time).toBeGreaterThan(0.2);
        await press(dialog.getByRole('button', { name: 'Use this recording' }));
        await see(page.getByRole('dialog')).toHaveCount(0);
        // Kept under Voice notes, named by when it was made.
        const items = voice.locator('.fd-file-item');
        await see(items).toHaveCount(2);
        await see(items.nth(1).locator('audio')).toHaveAccessibleName(/^Voice note \d{4}-\d\d-\d\d \d\d\.\d\d\.\d\d\.(webm|m4a|ogg)$/);
      },
    },
    {
      says: 'Press Record a video: the camera’s picture shows live',
      notOnPhone: NO_RECORDER,
      async run({ page, press, see }) {
        await devices(page, 'allow');
        await press(node(page, 'f-clips').getByRole('button', { name: 'Record a video' }));
        const dialog = page.getByRole('dialog', { name: 'Record a video' });
        // The camera's picture, live.
        const live = dialog.locator('video.fd-recorder-live');
        await see(live).toBeVisible();
        await expect.poll(() => live.evaluate((film: HTMLVideoElement) => film.videoWidth)).toBe(320);
        await press(dialog.getByRole('button', { name: 'Start recording' }));
        await see(dialog.getByRole('timer')).toHaveText(/^0:0[1-9] \/ 0:30$/);
        // Thirty seconds on, it stops by itself and says so.
        await see(dialog.getByRole('status')).toHaveText(/^Stopped at 0:30, the longest a recording may be here\. Recorded 0:30\./, { timeout: 45_000 });
        await see(dialog.getByRole('timer')).toHaveText('0:30 / 0:30');
        await see(dialog.locator('.fd-recorder-review video')).toBeVisible();
        await press(dialog.getByRole('button', { name: 'Use this recording' }));
        await see(node(page, 'f-clips').locator('.fd-file-item')).toHaveCount(1);
      },
    },
    {
      says: 'Refuse the microphone when the browser asks: the recorder says so',
      notOnPhone: NO_RECORDER,
      async run({ page, press, keys, see }) {
        await devices(page, 'refuse');
        await press(node(page, 'f-voice').getByRole('button', { name: 'Record a voice note' }));
        const dialog = page.getByRole('dialog', { name: 'Record a voice note' });
        await see(dialog.getByRole('status')).toHaveText('The microphone was not allowed. Allow it for this site in your browser’s settings, then press Try again, or add a recording as a file.');
        await see(dialog.getByRole('button', { name: 'Try again' })).toBeFocused();
        await see(dialog.getByRole('button', { name: 'Start recording' })).toBeHidden();
        await keys('Escape');
        await see(page.getByRole('dialog')).toHaveCount(0);
      },
    },
    {
      says: 'Under Floor plan, click where something needs mending',
      async run({ page, press, see }) {
        const snags = node(page, 'f-snags');
        const plan = snags.locator('.fd-pins-image');
        await see(snags.locator('.fd-pin')).toHaveCount(2);
        await plan.scrollIntoViewIfNeeded();
        const box = (await plan.boundingBox())!;
        await press(plan, { position: { x: box.width * 0.5, y: box.height * 0.5 } });
        // A pin there, the third, and its note's box waiting.
        await see(snags.locator('.fd-pin')).toHaveCount(3);
        const note = snags.getByRole('textbox', { name: 'Note for pin 3' });
        await see(note).toBeFocused();
        await page.keyboard.type('Cracked tile by the door', { delay: 15 });
        await see(snags.locator('.fd-pin').nth(2)).toHaveAccessibleName(/^Pin 3, \w+, (4\d|5\d)% across, (4\d|5\d)% down: Cracked tile by the door$/);
      },
    },
  ],
};
