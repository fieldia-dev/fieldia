import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { axeFindings } from './a11y-support';
import { expectNoSidewaysScroll, node, open, screen } from './support';

/**
 * Films and sounds in a file field, as an agent back from a site visit meets them: the video tour's films each shown
 * by a poster frame — the one the store made, or the film's own frame, drawn by the browser — under a play mark; a film
 * opened plays in the dialog's player from that frame, the arrows of the player its own; a voice note plays where it is
 * in the list. In every engine: where an engine cannot play the films' format, the dialog says so in the player's place.
 */

const tour = (page: Page) => node(page, 'f-tour');
const voice = (page: Page) => node(page, 'f-voice');
/** Whether this engine plays a WebM film (VP9) — an older Safari does not; it then says so. */
const playsWebm = (page: Page) => page.evaluate(() => document.createElement('video').canPlayType('video/webm; codecs="vp9"') !== '');
/** A player's state once it has played a moment: its time moved on, muted (a browser starts a sound only after a press). */
const played = (media: Locator) =>
  media.evaluate(async (element: HTMLMediaElement) => {
    element.muted = true;
    await element.play();
    await new Promise((done) => setTimeout(done, 700));
    element.pause();
    return { time: element.currentTime, duration: element.duration };
  });

test.describe('films and sounds in a file field', () => {
  test('the video tour’s films by their poster frames, a film played in the dialog, a voice note played in place', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=site-visit&record=1&skin=outlined');
    const cards = tour(page).locator('.fd-file-item');
    await expect(cards).toHaveCount(2);
    // Living room by the poster frame the store made; Walk-through by its own frame, drawn by the browser.
    const poster = cards.nth(0).locator('.fd-file-film img');
    await expect.poll(() => poster.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth)).toBe(480);
    const webm = await playsWebm(page);
    if (webm) await expect.poll(() => cards.nth(1).locator('.fd-file-film video').evaluate((film: HTMLVideoElement) => film.readyState >= 2 && film.videoWidth)).toBe(480);
    // Each a button named by its file, its picture hidden from a screen reader.
    await expect(cards.nth(0).locator('.fd-file-open')).toHaveAccessibleName('Living room.webm, 82 KB');
    await expect(cards.nth(1).locator('.fd-file-film')).toHaveAttribute('aria-hidden', 'true');
    await screen(page, 'media-site-visit');

    // Opened, Living room plays in the dialog's player, from the poster frame.
    await cards.nth(0).locator('.fd-file-open').click();
    const dialog = page.getByRole('dialog', { name: 'Living room.webm' });
    await expect(dialog).toBeVisible();
    if (webm) {
      const film = dialog.locator('video');
      await expect(film).toHaveAttribute('poster', '../samples/tour-poster.jpg');
      await expect(film).toHaveAccessibleName('Living room.webm');
      const { time, duration } = await played(film);
      expect(time).toBeGreaterThan(0.2);
      expect(duration).toBeCloseTo(6, 0);
      await screen(page, 'media-film-open', { viewport: true });
      // The player's own arrows move through the film: the dialog stays on it.
      await film.focus();
      await page.keyboard.press('ArrowRight');
      await expect(dialog.locator('h2')).toHaveText('Living room.webm');
    } else {
      await expect(dialog.locator('.fd-file-none p')).toHaveText('This browser cannot play it: download it to play it.');
    }
    // Elsewhere in the dialog they go to the next film, which starts from its own frame.
    await dialog.getByRole('button', { name: 'Next' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('dialog', { name: 'Walk-through.webm' })).toBeVisible();
    if (webm) await expect(page.getByRole('dialog', { name: 'Walk-through.webm' }).locator('video')).toHaveAttribute('src', '../samples/tour.webm#t=0.1');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // The voice note plays where it is, in the browser's own player under its name.
    const note = voice(page).locator('audio.fd-file-player');
    await expect(note).toHaveAccessibleName('Kitchen and balcony.webm');
    if (await page.evaluate(() => document.createElement('audio').canPlayType('audio/webm; codecs="opus"') !== '')) {
      const { time, duration } = await played(note);
      expect(time).toBeGreaterThan(0.2);
      expect(duration).toBeCloseTo(5.4, 0);
    }
    expect(await axeFindings(page, 'a site visit’s films and voice notes')).toEqual([]);
    expect(problems).toEqual([]);
  });

  test('on a phone, right to left and dark: the films’ cards fit, the play mark never turned', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const { problems } = await open(page, 'plain', 'page=site-visit&record=1&skin=outlined&locale=ar&dir=rtl&scheme=dark');
    const marks = tour(page).locator('.fd-file-film');
    await expect(marks).toHaveCount(2);
    // A media mark points the way a film plays, whichever way the page reads.
    const pointing = await marks.first().evaluate((frame) => getComputedStyle(frame, '::after').borderLeftWidth);
    expect(parseFloat(pointing)).toBeGreaterThan(10);
    await expect(voice(page).locator('audio')).toBeVisible();
    await expectNoSidewaysScroll(page);
    await screen(page, 'media-site-visit-phone-rtl');
    expect(problems).toEqual([]);
  });
});

/**
 * A voice note and a short film recorded on the page, in every engine that records: the browser's microphone and
 * camera stood in for by a tone and a moving picture made in the page (each engine's own MediaRecorder records them),
 * or refused, as a person who says no.
 */
async function devices(page: Page, how: 'allow' | 'refuse') {
  await page.addInitScript((refuse) => {
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
const records = (page: Page) => page.evaluate(() => typeof (window as any).MediaRecorder === 'function');

test.describe('a voice note and a short film recorded on the page', () => {
  test('a voice note recorded, played back, used, and stored with the visit; a film recorded from the camera', async ({ page }) => {
    await devices(page, 'allow');
    const { problems } = await open(page, 'plain', 'page=site-visit&record=1&skin=outlined');
    const record = voice(page).getByRole('button', { name: 'Record a voice note' });
    if (!(await records(page))) {
      // An engine with no recorder: no Record offered, the picker as before.
      await expect(record).toHaveCount(0);
      return;
    }
    // How long a recording may be, said before anyone records.
    await expect(voice(page).locator('.fd-file-limits')).toContainText('voice notes up to 2:00');
    await record.click();
    const dialog = page.getByRole('dialog', { name: 'Record a voice note' });
    await expect(dialog.getByRole('status')).toHaveText('Ready. Press Start recording.');
    await expect(dialog.getByRole('button', { name: 'Start recording' })).toBeFocused();
    expect(await axeFindings(page, 'the recorder, ready', '.fd-recorder')).toEqual([]);
    await dialog.getByRole('button', { name: 'Start recording' }).click();
    await expect(dialog.getByRole('status')).toHaveText('Recording…');
    await expect(dialog.getByRole('timer')).toHaveText(/^0:0[1-9] \/ 2:00$/);
    await screen(page, 'media-recording', { viewport: true });
    await dialog.getByRole('button', { name: 'Stop' }).click();
    await expect(dialog.getByRole('status')).toHaveText(/^Recorded 0:0\d\. Play it back, then use it or record again\.$/);
    const playback = dialog.locator('.fd-recorder-review audio');
    await expect(playback).toHaveAccessibleName(/^Voice note \d{4}-\d\d-\d\d \d\d\.\d\d\.\d\d\.(webm|m4a|ogg)$/);
    await expect.poll(() => playback.evaluate((sound: HTMLAudioElement) => sound.readyState)).toBeGreaterThan(0);
    await screen(page, 'media-recorded', { viewport: true });
    await dialog.getByRole('button', { name: 'Use this recording' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(record).toBeFocused();
    // Kept with the visit as a file picked is: stored through the source's upload, its link in the field.
    const items = voice(page).locator('.fd-file-item');
    await expect(items).toHaveCount(2);
    const keptNow = () => page.evaluate(() => ((window as any).fieldiaDemo.handle.form.getState().values.voice_notes as { name: string; type: string; url?: string; fileId?: number }[]).map(({ name, type, url, fileId }) => ({ name, type, stored: !!url, fileId })));
    await expect.poll(async () => (await keptNow())[1]?.fileId).toEqual(expect.any(Number));
    const kept = await keptNow();
    expect(kept[1]).toMatchObject({ type: expect.stringMatching(/^audio\/(webm|mp4|ogg)$/), stored: true, fileId: expect.any(Number) });
    await expect(items.nth(1).locator('audio.fd-file-player')).toHaveAccessibleName(kept[1].name);

    // A short film: the camera's picture live, then played back.
    await node(page, 'f-clips').getByRole('button', { name: 'Record a video' }).click();
    const film = page.getByRole('dialog', { name: 'Record a video' });
    await expect(film.getByRole('button', { name: 'Start recording' })).toBeVisible();
    await expect.poll(() => film.locator('video.fd-recorder-live').evaluate((live: HTMLVideoElement) => live.videoWidth)).toBe(320);
    await film.getByRole('button', { name: 'Start recording' }).click();
    await expect(film.getByRole('timer')).toHaveText(/^0:0[1-9] \/ 0:30$/);
    await film.getByRole('button', { name: 'Stop' }).click();
    await expect(film.locator('.fd-recorder-review video')).toBeVisible();
    await film.getByRole('button', { name: 'Use this recording' }).click();
    await expect(node(page, 'f-clips').locator('.fd-file-item')).toHaveCount(1);
    await screen(page, 'media-site-visit-recorded');
    expect(problems).toEqual([]);
  });

  test('a refused microphone said with Try again; a recording let go only once the person says so', async ({ page }) => {
    await devices(page, 'refuse');
    const { problems } = await open(page, 'plain', 'page=site-visit&record=1&skin=outlined');
    if (!(await records(page))) return;
    await voice(page).getByRole('button', { name: 'Record a voice note' }).click();
    const dialog = page.getByRole('dialog', { name: 'Record a voice note' });
    await expect(dialog.getByRole('status')).toHaveText('The microphone was not allowed. Allow it for this site in your browser’s settings, then press Try again, or add a recording as a file.');
    await expect(dialog.getByRole('button', { name: 'Try again' })).toBeFocused();
    await expect(dialog.getByRole('button', { name: 'Start recording' })).toBeHidden();
    await screen(page, 'media-recorder-refused', { viewport: true });
    // Nothing recorded: Escape closes at once.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(problems).toEqual([]);
  });

  test('Escape asks before a recording made is let go, and Go back keeps it', async ({ page }) => {
    await devices(page, 'allow');
    const { problems } = await open(page, 'plain', 'page=site-visit&record=1&skin=outlined');
    if (!(await records(page))) return;
    await voice(page).getByRole('button', { name: 'Record a voice note' }).click();
    const dialog = page.getByRole('dialog', { name: 'Record a voice note' });
    await dialog.getByRole('button', { name: 'Start recording' }).click();
    await expect(dialog.getByRole('timer')).toHaveText(/^0:01/);
    await dialog.getByRole('button', { name: 'Stop' }).click();
    await page.keyboard.press('Escape');
    await expect(dialog.getByText('Discard this recording?')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Go back' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(dialog.getByRole('button', { name: 'Use this recording' })).toBeFocused();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await dialog.getByRole('button', { name: 'Discard' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(voice(page).locator('.fd-file-item')).toHaveCount(1);
    expect(problems).toEqual([]);
  });
});
