/**
 * How long a demo took to show its page the first time, for e2e/perf.spec.ts.
 * Call before making and mounting the page, then call what it returns once it
 * is mounted: `fieldiaTimings[name]` gets the main thread's work, from the
 * start to the end of the paint that shows the page, leaving out the wait for
 * the screen's next frame, and the whole time with that wait.
 */
export function timeFirstPaint(name: string): () => void {
  const started = performance.now();
  return () => {
    const mounted = performance.now();
    requestAnimationFrame(() => {
      const frame = performance.now();
      // A message sent from a frame's callback arrives once that frame is painted.
      const channel = new MessageChannel();
      channel.port1.onmessage = () => {
        const painted = performance.now();
        const timings = ((window as unknown as { fieldiaTimings?: Record<string, { work: number; total: number }> }).fieldiaTimings ??= {});
        timings[name] = { work: mounted - started + (painted - frame), total: painted - started };
      };
      channel.port2.postMessage(null);
    });
  };
}
