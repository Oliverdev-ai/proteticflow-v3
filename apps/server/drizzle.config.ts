import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? 'postgresql://proteticflow:proteticflow_dev@localhost:5432/proteticflow_dev',
  },
  verbose: true,
  strict: false,
});
