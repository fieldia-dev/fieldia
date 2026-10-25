/**
 * Yes and no in every language Fieldia speaks, as each language's words say them (`yes`, `no`: held to them by
 * yes-no.spec.ts), for reading a file brought in: a file typed in Arabic reads on a page in English, though each
 * language's words come in a chunk of their own (0.35). The one-tag script builds this module as an empty one: there a
 * file reads in English and in the languages whose add-ons are in, as ever (tools/script-bundle.mjs).
 */
export const FILE_YES_NO: { readonly yes: readonly string[]; readonly no: readonly string[] } = {
  yes: ['نعم', 'Ja', 'Oui', 'Evet', 'بله', 'ہاں', 'Sí'],
  no: ['لا', 'Nein', 'Non', 'Hayır', 'خیر', 'نہیں', 'No'],
};
