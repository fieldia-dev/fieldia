import type { FileValue, Values } from '@fieldia/core';

/**
 * An agent's visit to a flat before it is listed (the site-visit page): its video tour — one film with the poster frame
 * the store made, one with none, whose frame the browser draws — a voice note taken on the visit, and room for more voice
 * notes and short videos recorded on the page, and what to mend pinned on the flat's floor plan. The films and the sound are the demos' own samples (demos/samples),
 * beside the demo's page. Sample data.
 */

/** A sample of the demos', by its address beside the demo's page (every framework's demo is a folder beside samples/). */
const sample = (file: string) => `../samples/${file}`;

const TOUR: FileValue = { name: 'Living room.webm', type: 'video/webm', size: 83993, url: sample('tour.webm'), poster: sample('tour-poster.jpg') };
const WALK: FileValue = { name: 'Walk-through.webm', type: 'video/webm', size: 83993, url: sample('tour.webm') };
const PLAN: FileValue = { name: 'floor-plan.svg', type: 'image/svg+xml', size: 1851, url: sample('floor-plan.svg') };
const NOTE: FileValue = { name: 'Kitchen and balcony.webm', type: 'audio/webm', size: 15546, url: sample('voice-note.webm') };

/** The visits kept, by id. */
export function siteVisits(): Record<string, Values> {
  return {
    1: { unit: 'B-1204, Palm Hills, New Cairo', visited_on: '2026-10-19', agent: 'Mona Adel', condition: 'minor', tour: [TOUR, WALK], voice_notes: [NOTE], clips: [], floor_plan: PLAN, snags: [{ x: 0.76, y: 0.2, note: 'Kitchen tap drips' }, { x: 0.3, y: 0.88, note: 'Balcony door sticks' }] },
  };
}
