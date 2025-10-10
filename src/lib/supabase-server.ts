/**
 * Supabase server-side client for ImgGo
 * Uses service role key for privileged operations
 * Should NEVER be exposed to the browser
 */

import { createClient } from "@supabase/supabase-js";
import { Database } from "./database.types";
import { logger } from "./logger";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_URL");
}

if (!supabaseServiceRoleKey) {
  throw new Error("Missing env.SUPABASE_SERVICE_ROLE_KEY");
}

/**
 * Server-side Supabase client with service role privileges
 * Bypasses RLS - use with caution
 */
const _supabaseServer = createClient<Database>(
  supabaseUrl!,
  supabaseServiceRoleKey!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: "public",
    },
  }
);

// Re-export with explicit type to help TypeScript
export const supabaseServer = _supabaseServer as ReturnType<typeof createClient<Database>>;

/**
 * Create a server client with user context (respects RLS)
 * Use this when you want RLS enforcement on the server
 */
export function createServerClient(accessToken: string) {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Supabase environment variables not configured");
  }

  return createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Initialize PGMQ queue on application startup
 */
export async function initializePGMQ(): Promise<void> {
  const queueName = process.env.SUPABASE_PGMQ_QUEUE || "ingest_jobs";

  try {
    // Create queue if it doesn't exist
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseServer.rpc as any)("pgmq_create", {
      queue_name: queueName,
    });

    if (error && !error.message.includes("already exists")) {
      throw error;
    }

    logger.info("PGMQ queue initialized", { queue_name: queueName });
  } catch (error) {
    logger.error("Failed to initialize PGMQ queue", error, {
      queue_name: queueName,
    });
    throw error;
  }
}
