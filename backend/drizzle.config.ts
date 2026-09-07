import "./src/lib/env.js";
import { defineConfig } from "drizzle-kit";


/**
 * Drizzle config for the Puro API.
 * Generates the SQL schema from the TypeScript schema.
 * Runs with `npx drizzle-kit push` to update the database.
 */
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://puro:puro@localhost:5432/puro_banking",
  },
});
