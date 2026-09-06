import postgres from "postgres";

// Singleton pattern so Next.js's dev-mode hot-reload doesn't open a fresh
// connection pool on every file save — without this you'll exhaust
// Postgres's connection limit within a few minutes of editing code.
declare global {
  var __sql: ReturnType<typeof postgres> | undefined;
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set — check .env.local (see SETUP.md §4/§7).");
}

const sql = global.__sql ?? postgres(connectionString, { max: 10 });

if (process.env.NODE_ENV !== "production") {
  global.__sql = sql;
}

export default sql;
