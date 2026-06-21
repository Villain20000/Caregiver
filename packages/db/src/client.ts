/**
 * packages/db/src/client.ts
 *
 * Drizzle ORM client factory.
 *
 * Creates a typed Drizzle instance connected to PostgreSQL using the
 * `postgres` JS driver (lighter than `pg` and supports ESM).
 *
 * Reads DATABASE_URL from the environment. Falls back to individual
 * POSTGRES_* env vars if DATABASE_URL is not set.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

/** Type alias for the Drizzle database instance (with our schema bound). */
export type Database = ReturnType<typeof createDb>;

/**
 * Create a Drizzle ORM client connected to PostgreSQL.
 *
 * @param url - Optional database URL. Defaults to DATABASE_URL env var,
 *              or a constructed URL from POSTGRES_* env vars.
 * @returns A typed Drizzle database instance with all schema tables bound.
 *
 * @example
 *   import { createDb } from '@caregiver/db';
 *   const db = createDb();
 *   const users = await db.select().from(schema.users);
 */
export function createDb(url?: string): ReturnType<typeof drizzle<typeof schema>> {
  // Resolve the connection URL.
  const connectionString =
    url ??
    process.env.DATABASE_URL ??
    `postgresql://${process.env.POSTGRES_USER ?? 'caregiver'}:${process.env.POSTGRES_PASSWORD ?? 'caregiver_dev'}@${process.env.POSTGRES_HOST ?? 'localhost'}:${process.env.POSTGRES_PORT ?? '5432'}/${process.env.POSTGRES_DB ?? 'caregiver'}`;

  // Create the postgres.js client with reasonable pool defaults.
  const client = postgres(connectionString, {
    max: 10, // Max connections in the pool.
    idle_timeout: 20, // Seconds before idle connections are closed.
    connect_timeout: 10, // Seconds to wait for a connection.
  });

  // Bind the schema so Drizzle can provide typed query building.
  return drizzle(client, { schema });
}
