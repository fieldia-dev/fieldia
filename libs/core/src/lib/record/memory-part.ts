/**
 * The memory part (memory-later.ts): a memory source's members — every one a backend has, working on what the source
 * keeps — for the one-tag script, whose `createMemoryDataSource` hands an app its source at once and its members as
 * this part comes. A page whose app gives its own data source never loads it. The packages' `createMemoryDataSource`
 * is whole, as ever.
 */
export { createMemoryDataSource, memorySource } from './memory-data-source';
