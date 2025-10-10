/**
 * Supabase type-safe helper functions
 * Workaround for Supabase's generic type inference limitations with Next.js 15
 *
 * Why we need this:
 * Supabase's PostgREST generic type system has trouble inferring types correctly
 * in Next.js 15 environment, returning 'never' types. These helpers provide a
 * clean abstraction layer with controlled 'any' usage that maintains type safety
 * at the API boundary while working around internal inference issues.
 */

import { Database } from "./database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

type Tables = Database["public"]["Tables"];
type TableName = keyof Tables;
type Functions = Database["public"]["Functions"];
type FunctionName = keyof Functions;

/**
 * Standard Supabase response format
 */
type SupabaseResponse<T> = {
  data: T | null;
  error: {
    message: string;
    details: string;
    hint: string;
    code: string;
  } | null;
};

/**
 * Type-safe insert helper - returns inserted row
 */
export async function insertRow<T extends TableName>(
  client: SupabaseClient<Database>,
  table: T,
  data: Tables[T]["Insert"]
): Promise<SupabaseResponse<Tables[T]["Row"]>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return await (client.from(table) as any).insert(data).select().single();
}

/**
 * Type-safe update helper - returns updated row(s)
 */
export async function updateRow<T extends TableName>(
  client: SupabaseClient<Database>,
  table: T,
  data: Tables[T]["Update"],
  condition: { column: string; value: string | number | boolean }
): Promise<SupabaseResponse<Tables[T]["Row"]>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return await (client.from(table) as any)
    .update(data)
    .eq(condition.column, condition.value)
    .select()
    .single();
}

/**
 * Type-safe update helper without select - for performance when result not needed
 */
export async function updateRowNoReturn<T extends TableName>(
  client: SupabaseClient<Database>,
  table: T,
  data: Tables[T]["Update"],
  condition: { column: string; value: string | number | boolean }
): Promise<{ error: { message: string; code: string } | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  condition?: { column: string; value: string | number | boolean }
): Promise<SupabaseResponse<Tables[T]["Row"][]>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query = (client.from(table) as any).select("*");
  if (condition) {
    return await query.eq(condition.column, condition.value);
  }
  return await query;
}

/**
 * Type-safe delete helper
 */
export async function deleteRow<T extends TableName>(
  client: SupabaseClient<Database>,
  table: T,
  condition: { column: string; value: string | number | boolean }
): Promise<{ error: { message: string; code: string } | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return await (client.from(table) as any)
    .delete()
    .eq(condition.column, condition.value);
}

/**
 * Type-safe RPC helper with proper return type inference
 */
export async function callRpc<T extends FunctionName>(
  client: SupabaseClient<Database>,
  functionName: T,
  args: Functions[T]["Args"]
): Promise<SupabaseResponse<Functions[T]["Returns"]>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return await (client.rpc as any)(functionName, args);
}
