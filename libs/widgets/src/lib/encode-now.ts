/**
 * How long a canvas's `toBlob` is given before its picture is encoded at once instead (`encodeSoon`), in ms. Measured on
 * the clinic's 1200 × 900 photo: `toBlob` answers in 16–23 ms on a quiet machine, and when it is not stalled, with a
 * median of 143 ms and 271 ms at p90 on four cores shared by six browsers. When stalled, it answers at 1,019 ms or later
 * (Chromium's own 1 s timer to start an encode the page gave no idle time for), else at about 6.7 s. 200 lets an unstalled
 * `toBlob` win on a quiet machine with ten times its time to spare, cuts every stall, and keeps the worst case (the cap
 * and one encode) near a quarter of a second for that photo.
 */
export const ENCODE_CAP_MS = 200;

/**
 * A canvas's picture as a file's bytes, encoded at once on the page's thread: null where the browser makes none. Not
 * `toBlob`, nor an OffscreenCanvas's `convertToBlob`: Chromium encodes those in the page's idle time, and on a busy
 * machine, which gives it none, waits for its own timers — a photo's Apply was left 1 s, or 6.7 s, its dialog open. A
 * type the browser cannot write comes back as one it can (a PNG): the bytes' type says which.
 */
export function encodeNow(canvas: HTMLCanvasElement, type: string, quality: number): Blob | null {
  try {
    const [head, base64] = canvas.toDataURL(type, quality).split(',');
    return /;base64$/.test(head) ? new Blob([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], { type: head.slice(5, -7) }) : null;
  } catch {
    return null;
  }
}

/**
 * A canvas's picture as a file's bytes, never waited for long: the browser's `toBlob` first, which encodes without
 * holding the page (a large photo on a phone keeps it free), and where it has not answered within `cap` ms, encoded at
 * once (`encodeNow`), its late answer dropped. So the wait is the cap and one encode at most, never seconds.
 */
export function encodeSoon(canvas: HTMLCanvasElement, type: string, quality: number, cap = ENCODE_CAP_MS): Promise<Blob | null> {
  return new Promise((resolve) => {
    let answered = false;
    const answer = (blob: Blob | null) => {
      if (answered) return;
      answered = true;
      clearTimeout(timer);
      resolve(blob);
    };
    const timer = setTimeout(() => answer(encodeNow(canvas, type, quality)), cap);
    try {
      canvas.toBlob(answer, type, quality);
    } catch {
      answer(encodeNow(canvas, type, quality));
    }
  });
}
