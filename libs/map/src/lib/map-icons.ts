import type { IconSet } from '@fieldia/widgets';

/**
 * The maps' own icons, beside Fieldia's (home, building, truck, user, pin…),
 * for a pin that shows what it stands for: a car, a scooter, a shop. Drawn
 * like Fieldia's: lines on a 24 grid in the current colour. Those that turn
 * with a heading (the car, the arrow) face up, as north is on the map.
 */
export const MAP_ICONS: IconSet = {
  car: '<rect x="6.5" y="2.5" width="11" height="19" rx="3.5"/><path d="M8.5 9l1-2.5h5l1 2.5zM8.5 17.5h7"/>',
  arrow: '<path d="M12 3l7 18-7-4-7 4z"/>',
  scooter: '<circle cx="6" cy="17" r="2.5"/><circle cx="18" cy="17" r="2.5"/><path d="M8.5 17h7M14 5h2.5l2 9.5M11 14h6.5"/>',
  bike: '<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-7h6l2 7M10 9l2 7M14 5.5h3"/>',
  bus: '<rect x="5" y="3" width="14" height="15" rx="2.5"/><path d="M5 11h14M8 18v3M16 18v3M8.5 14.5h.01M15.5 14.5h.01"/>',
  person: '<circle cx="12" cy="4.5" r="2"/><path d="M12 7v6l-3 7M12 13l3 7M8 10h8"/>',
  shop: '<path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9c0 1.7 1.8 3 4 3s4-1.3 4-3c0 1.7 1.8 3 4 3s4-1.3 4-3M10 20v-5h4v5"/>',
  food: '<path d="M5 3v6a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2 1-3 4-3 8h3"/>',
  flag: '<path d="M5 21V4h11l-2 4 2 4H5"/>',
};
