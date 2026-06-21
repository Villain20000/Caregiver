/**
 * packages/db/src/index.ts
 *
 * Public API for the @caregiver/db package.
 *
 * Exports:
 *   - Drizzle schema (all table definitions)
 *   - Client factory (createDb) for connecting to PostgreSQL
 *   - Schema object for use in queries
 *   - Types for all table rows
 */
export * from './schema/index.js';
export { createDb, type Database } from './client.js';
export { schema } from './schema/index.js';
