import "../lib/env.js";

process.env.DATABASE_URL ??=
  "postgresql://puro:puro@localhost:5432/puro_banking";
process.env.SESSION_SECRET ??= "test-session-secret";
process.env.FRONTEND_URL ??= "http://localhost:5173";
process.env.NODE_ENV = "test";
