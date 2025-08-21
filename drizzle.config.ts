import type { Config } from 'drizzle-kit';
import 'dotenv/config';

export default {
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/escribiendo_dev',
  },
} satisfies Config;