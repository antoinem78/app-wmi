// The client-identity spine. Resolves a SingularWeb-level client to its
// per-plane ids so the console can pull Engine B data for an Engine A client.
//
// Reads the platform_client map from THIS app's DB (Engine A) via the admin
// Supabase client. Map, don't migrate: one row links the two planes.

import { createSupabaseAdminClient } from "@/lib/supabase/server";

export interface PlatformClient {
  id: string;
  name: string;
  doorway: string | null;
  engine_a_client_id: string | null;
  engine_b_client_id: string | null;
  ghl_location_id: string | null;
  google_ads_customer_id: string | null;
  is_own_property: boolean;
}

const COLS =
  "id,name,doorway,engine_a_client_id,engine_b_client_id,ghl_location_id,google_ads_customer_id,is_own_property";

export async function getByEngineAClientId(engineAClientId: string): Promise<PlatformClient | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("platform_client")
    .select(COLS)
    .eq("engine_a_client_id", engineAClientId)
    .maybeSingle();
  return (data as PlatformClient | null) ?? null;
}

export async function listPlatformClients(): Promise<PlatformClient[]> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from("platform_client").select(COLS).order("name");
  return (data as PlatformClient[] | null) ?? [];
}

// Convenience: the Engine B id for an Engine A client, or null if the client
// has no conversion-plane presence (nothing to show from the substrate).
export async function engineBIdForEngineA(engineAClientId: string): Promise<string | null> {
  const pc = await getByEngineAClientId(engineAClientId);
  return pc?.engine_b_client_id ?? null;
}
