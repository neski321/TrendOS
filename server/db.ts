import { Pool } from "pg";
import dotenv from "dotenv";
import { resolve } from "path";

// Load .env from root or backend directory
dotenv.config({ path: resolve(process.cwd(), ".env") });
dotenv.config({ path: resolve(process.cwd(), "backend", ".env") });

// Get DATABASE_URL from environment (same as Python backend)
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required");
}

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes("neon.tech") ? { rejectUnauthorized: false } : undefined,
});

// Test connection
pool.on("connect", () => {
  console.log("Connected to NeonDB");
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

