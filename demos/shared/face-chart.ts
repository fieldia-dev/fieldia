import type { Values } from '@fieldia/core';

/**
 * A treatment at a clinic (the face-chart page): where each injection went, as pins on a chart of the face (the demos'
 * own drawing, demos/samples/face.svg), each with the product and the units given there. Sample data.
 */
export function treatments(): Record<string, Values> {
  return {
    1: {
      patient: 'Hana Fouad',
      treated_on: '2026-10-19',
      doctor: 'Dr. Salma Nour',
      injections: [
        { x: 0.4, y: 0.33, note: 'Botox, 4 units' },
        { x: 0.6, y: 0.33, note: 'Botox, 4 units' },
        { x: 0.31, y: 0.47, note: 'Botox, 2 units (crow’s feet)' },
        { x: 0.69, y: 0.47, note: 'Botox, 2 units (crow’s feet)' },
        { x: 0.5, y: 0.68, note: 'Filler, 0.5 ml' },
      ],
      review: 'Check the forehead lines; add 2 units each side if needed.',
    },
  };
}
