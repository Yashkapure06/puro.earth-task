import "../lib/env.js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://puro:puro@localhost:5432/puro_banking";

const queryClient = postgres(databaseUrl, {
  max: 10,
});

export const db = drizzle(queryClient, { schema });
export type Database = typeof db;

export { queryClient };
