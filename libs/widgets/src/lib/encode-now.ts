/**
 * A canvas's picture as a file's bytes, encoded at once on the page's thread: null where the browser makes none. Not
 * `toBlob`, nor an OffscreenCanvas's `convertToBlob`: Chromium encodes those in the page's idle time, and on a busy
 * machine, which gives it none, waits for its own timers — a photo's Apply was left 1 s, or 6.7 s, its dialog open. The
 * same work, done now. A type the browser cannot write comes back as one it can (a PNG): the bytes' type says which.
 */
export function encodeNow(canvas: HTMLCanvasElement, type: string, quality: number): Blob | null {
  try {
    const [head, base64] = canvas.toDataURL(type, quality).split(',');
    return /;base64$/.test(head) ? new Blob([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], { type: head.slice(5, -7) }) : null;
  } catch {
    return null;
  }
}
