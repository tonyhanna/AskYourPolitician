import { neon, Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzleServerless } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

// In local dev (Node.js runtime), use WebSocket pooling for much faster queries.
// In Edge runtime (middleware) or production, use HTTP mode.
const isEdge = typeof (globalThis as Record<string, unknown>).EdgeRuntime !== "undefined";

function createDb() {
  if (process.env.NODE_ENV === "development" && !isEdge) {
    // WebSocket-based persistent connection — avoids per-query HTTP overhead
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ws = require("ws");
    neonConfig.webSocketConstructor = ws;
    const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
    return drizzleServerless(pool, { schema });
  }
  // HTTP mode — works in Edge runtime and production serverless
  const sql = neon(process.env.DATABASE_URL!);
  return drizzleHttp(sql, { schema });
}

export const db = createDb() as ReturnType<typeof drizzleServerless>;
