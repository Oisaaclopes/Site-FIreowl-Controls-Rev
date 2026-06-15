import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!dbInstance) {
    if (!connectionString) {
      throw new Error("DATABASE_URL is required to connect to the database. Please configure it in your environment / secrets.");
    }
    const client = postgres(connectionString);
    dbInstance = drizzle(client, { schema });
  }
  return dbInstance;
}
