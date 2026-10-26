import type { Replays } from './hand';
import { accounting } from './accounting';
import { buildingBlocks } from './building-blocks';
import { clinic } from './clinic';
import { crm } from './crm';
import { operations } from './operations';
import { people } from './people';
import { realEstate } from './real-estate';
import { realEstateMore } from './real-estate-more';
import { sales } from './sales';
import { surveys } from './surveys';

/** Every demo's how-to replayed, by its area as the catalogue groups them (demos/catalog.mjs, AREAS). */
export const REPLAYS: Record<string, Replays> = {
  sales,
  accounting,
  crm,
  people,
  operations,
  clinic,
  // Twenty demos, in two files: the first ten and the rest, as the catalogue lists them.
  'real-estate': { ...realEstate, ...realEstateMore },
  surveys,
  'building-blocks': buildingBlocks,
};
