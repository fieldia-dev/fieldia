import type { Values } from '@fieldia/core';

/**
 * Areas of Greater Cairo as a tree — a district, its neighbourhoods — for a buyer's areas wanted on the lead page
 * (`"widget": "tree"`): all of Nasr City, or two neighbourhoods of New Cairo. Each record names its path from the
 * top down, as a link's tree reads it (the memory source's `shows`). Invented as a sample: not every district there is.
 */
const TREE: [string, string[]][] = [
  ['New Cairo', ['Fifth Settlement', 'First Settlement', 'Rehab', 'Madinaty', 'Mostakbal City']],
  ['Nasr City', ['District 7', 'District 8', 'Makram Ebeid', 'Abbas El Akkad']],
  ['Heliopolis', ['Korba', 'Almaza', 'Sheraton']],
  ['Maadi', ['Sarayat', 'Degla', 'Zahraa El Maadi']],
  ['Sheikh Zayed', ['Beverly Hills', 'Westown', 'Zayed 2000']],
  ['6th of October', ['Hadayek October', 'Palm Hills', 'October Gardens']],
];

/** The areas by id: each district first, then its neighbourhoods, each with its path. */
export const AREAS: Record<number, Values> = (() => {
  const rows: Record<number, Values> = {};
  let id = 1;
  for (const [district, neighbourhoods] of TREE) {
    rows[id++] = { name: district, path: [district] };
    for (const neighbourhood of neighbourhoods) rows[id++] = { name: neighbourhood, path: [district, neighbourhood] };
  }
  return rows;
})();

/** What a link to an area shows besides its name: its path, so a tree can place it. */
export const AREA_SHOWS = { area: { path: 'path' } };

/** An area as a link holds it, by its name. */
export const area = (name: string) => {
  const found = Object.entries(AREAS).find(([, row]) => row['name'] === name);
  return found ? { id: Number(found[0]), label: name, path: found[1]['path'] as string[] } : null;
};
