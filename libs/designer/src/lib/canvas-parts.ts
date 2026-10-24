import type { Page } from '@fieldia/core';
import { partsFor } from '@fieldia/viewer';
import { decodePart, evidencePart, filesPart, photosPart, scanPart, type WidgetFactory } from '@fieldia/widgets';

/**
 * Parts an inert canvas never draws from: a file's, a signature's evidence, a photo set's, a scan's — each loaded by
 * an upload, a camera or a press, never by a box that is only looked at.
 */
const BY_INTERACTION = new Set<unknown>([filesPart, evidencePart, photosPart, scanPart, decodePart]);

/**
 * Every part an editor's canvas draws the page from, asked for at once as the editor opens — never kind by kind as the
 * canvas reaches each (0.32: the designer's parts came in three waves). Those it never draws from are left to what
 * needs them: asked too, they only slowed the rest (on 4G, the canvas whole 90 ms later). One that cannot come is drawn
 * plainly, as ever.
 */
export function askCanvasParts(page: Page, widgets?: Record<string, WidgetFactory>): void {
  for (const part of partsFor(page, widgets)) if (!BY_INTERACTION.has(part)) part.load().catch(() => undefined);
}
