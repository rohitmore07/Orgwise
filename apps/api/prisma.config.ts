import 'dotenv/config';
import { defineConfig } from 'prisma/config';
// Prisma 6 reads DATABASE_URL from the schema's datasource block; the config
// only sets the schema path + seed command and loads `.env` for the CLI.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'ts-node prisma/seed.ts',
  },
});
