/**
 * The real pages in the gallery: Sherkety ERP's own screens rebuilt in
 * Fieldia, one file per lane so each is added on its own.
 */
import accounting from './accounting.mjs';
import crm from './crm.mjs';
import legal from './legal.mjs';
import operations from './operations.mjs';
import people from './people.mjs';
import sales from './sales.mjs';

export const REAL_DEMOS = [...sales, ...accounting, ...crm, ...people, ...operations, ...legal];
