/**
 * Supabase type-safe helper functions
 * Workaround for Supabase's generic type inference limitations
 */

import { Database } from "./database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

type Tables = Database["public"]["Tables"];
type TableName = keyof Tables;

/**
 * Type-safe insert helper
 */
export async function insertRow<T extends TableName>(
  client: SupabaseClient<Database>,
  table: T,
  data: Tables[T]["Insert"]
) {
  return await (client.from(table) as any).insert(data).select().single();
}

/**
 * Type-safe update helper
 */
export async function updateRow<T extends TableName>(
  client: SupabaseClient<Database>,
  table: T,
  data: Tables[T]["Update"],
  condition: { column: string; value: any }
) {
  return await (client.from(table) as any)
    .update(data)
    .eq(condition.column, condition.value);
}

/**
 * Type-safe select helper
 */
export async function selectRow<T extends TableName>(
  client: SupabaseClient<Database>,
  table: T,
  condition?: { column: string; value: any }
) {
  const query = (client.from(table) as any).select("*");
  if (condition) {
    return await query.eq(condition.column, condition.value);
  }
  return await query;
}

/**
 * Type-safe RPC helper
 */
export async function callRpc<T extends keyof Database["public"]["Functions"]>(
  client: SupabaseClient<Database>,
  functionName: T,
  args: Database["public"]["Functions"][T]["Args"]
) {
  return await (client.rpc as any)(functionName, args);
}
