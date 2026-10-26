import { neon } from '@neondatabase/serverless';
// Neon Postgres serverless HTTP client. Connects directly using the DATABASE_URL environment variable.
export function getDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not defined in environment variables.');
  }
  return neon(connectionString);
}
