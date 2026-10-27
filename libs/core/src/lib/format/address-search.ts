import * as z from 'zod';
import { ruled } from './ruled';
import { FIELD_NAME } from './names';
import { makeSchemasJitless } from './jitless';

// zod compiles no code for these schemas: a strict Content-Security-Policy refuses it (jitless.ts).
makeSchemasJitless();

/**
 * An address typed on one line with the addresses a map's provider suggests
 * (`"widget": "address-search"` on a char field, drawn by @fieldia/map): its
 * options. A suggestion picked can fill a place field (`placeField`, a json
 * field's GeoJSON Point, or a float field's latitude with `longitudeField`
 * for its longitude) and an address in its parts (`partsField`, a json field
 * drawn as an address); `countries` keeps the suggestions to some countries,
 * by their ISO codes, an array or "EG,SA" as the designer writes it; `near`
 * puts those near a point first. The fields they name are checked with the
 * page's references, by kind.
 *
 *   { "field": "address", "widget": "address-search",
 *     "options": { "placeField": "deliver_to", "partsField": "address_parts", "countries": ["EG"] } }
 */

const fieldName = z.string().regex(FIELD_NAME);
const COUNTRY = /^[A-Z]{2}$/;
const country = z.string().regex(COUNTRY, 'a country is its ISO code in capitals, such as "EG"');

export const AddressSearchOptionsSchema = z
  .strictObject({
    placeField: fieldName.optional(),
    longitudeField: fieldName.optional(),
    partsField: fieldName.optional(),
    countries: z.union([z.array(country).min(1), ruled(z.string(), 'countryCodes')]).optional(),
    near: z.strictObject({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).optional(),
  })
  .meta({ id: 'AddressSearchOptions' });

export type AddressSearchOptions = z.infer<typeof AddressSearchOptionsSchema>;
