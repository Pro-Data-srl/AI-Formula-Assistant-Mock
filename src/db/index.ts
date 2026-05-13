import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://formel:formel@localhost:5433/formel_assistent";

export const db = drizzle(connectionString, { schema });
