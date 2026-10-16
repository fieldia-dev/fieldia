import type { Locale, RecordId, Value } from '@fieldia/core';
import { formatNumber } from './numbers';

/**
 * An analytic distribution's value: Flectra's analytic_distribution, an
 * object of shares by account, `{"12": 60, "14": 40}`, the key an account's
 * id (or ids joined by commas, one per plan), the share a per cent. How it is
 * read and written in words, for a table's cell and a grid's: the main
 * script's. Its lines, typed in, come in the business part
 * (distribution-lines.ts), the first time a page shows one (widget-parts.ts).
 */

/** The model a distribution's accounts are records of: its `options.model`, else Flectra's analytic accounts. */
export const distributionModel = (options: Readonly<Record<string, unknown>> | undefined): string => (typeof options?.['model'] === 'string' ? (options['model'] as string) : 'account.analytic.account');

/** The accounts' ids a distribution names, each once, as a data source finds them. */
export function distributionIds(value: Value | undefined): RecordId[] {
  return [...new Set(sharesOf(value).flatMap(([key]) => key.split(',')))].map((one) => (/^\d+$/.test(one) ? Number(one) : one));
}

/**
 * A distribution in a few words, for a table's cell: each account by its
 * name — `nameOf`, when it knows it — and its share, "Sales 60% · Marketing
 * 40%"; the shares alone without names. Empty for none.
 */
export function distributionWords(value: Value | undefined, locale: Locale = 'en', nameOf?: (id: string) => string | undefined): string {
  const percent = (n: number) => `${formatNumber(n, Number.isInteger(n) ? 0 : 2, locale)}%`;
  return sharesOf(value)
    .map(([key, share]) => {
      const name = nameOf ? key.split(',').map((one) => nameOf(one) ?? `#${one}`).join(' · ') : '';
      return name ? `${name} ${percent(share)}` : percent(share);
    })
    .join(nameOf ? ', ' : ' · ');
}

/** Its shares, account by account, in the value's order: a share that is no number is 0. */
export const sharesOf = (value: Value | undefined): [string, number][] =>
  value && typeof value === 'object' && !Array.isArray(value) ? Object.entries(value as Record<string, unknown>).map(([key, share]) => [key, typeof share === 'number' ? share : Number(share) || 0]) : [];
