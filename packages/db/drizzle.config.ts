/**
 * packages/db/drizzle.config.ts
 *
 * Drizzle Kit configuration — used by `drizzle-kit generate` and `drizzle-kit studio`.
 *
 * This file tells Drizzle Kit:
 *   - Where the schema source is (src/schema/index.ts)
 *   - Where to output migration files (drizzle/)
 *   - How to connect to the database (DATABASE_URL)
 *
 * Run:
 *   npm run db:generate  → generates SQL migration files from schema changes
 *   npm run db:studio    → opens Drizzle Studio GUI at https://local.studio.drizzle.team
 */
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  // Path to the Drizzle schema source file.
  schema: './src/schema/index.ts',
  // Directory where generated migration SQL files are written.
  out: './drizzle',
  // Database driver — we use the `postgres` (postgres.js) driver.
  dialect: 'postgresql',
  // Database credentials — read from environment.
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      `postgresql://${process.env.POSTGRES_USER ?? 'caregiver'}:${process.env.POSTGRES_PASSWORD ?? 'caregiver_dev'}@${process.env.POSTGRES_HOST ?? 'localhost'}:${process.env.POSTGRES_PORT ?? '5432'}/${process.env.POSTGRES_DB ?? 'caregiver'}`,
  },
  // Print SQL statements as they're executed.
  verbose: true,
  // Ask for confirmation before destructive operations.
  strict: true,
});
