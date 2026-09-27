// Server-only entry point for all persistence. Never import this from a
// Client Component: it is the only place that touches the Supabase service
// role key (when configured) and is the sole source of truth for which
// storage backend the app is currently running against.

import { memoryStore } from "./memory-store";
import { supabaseStore } from "./supabase-store";
import type { Store } from "./store";

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getStore(): Store {
  return isSupabaseConfigured() ? supabaseStore : memoryStore;
}

export {
  type GroupFull,
  type NewGroupResult,
} from "./store";
export * from "./store-types";
