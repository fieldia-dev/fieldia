/**
 * The main script's modules a part takes what it shares from, in the order both are built with (tools/script-bundle.mjs):
 * made the first time a part is taken, once every module of the main script has run.
 */
declare module 'fieldia:shared' {
  export const SHARED: () => readonly unknown[];
}
