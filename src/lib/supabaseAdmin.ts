import { createClient } from "@supabase/supabase-js";

// Service-role client: bypasses RLS entirely, so it must only ever be
// imported from server-side API routes (src/pages/api/*.ts with
// `prerender = false`), never from a client <script> or a prerendered
// .astro frontmatter that ships to the browser. SUPABASE_SERVICE_ROLE_KEY
// has no PUBLIC_ prefix, so Vite already refuses to expose it to client
// bundles — this file is an extra guardrail, not the only one.
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

export function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Faltan PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY. Copia el valor de Project Settings > API > service_role a tu .env."
    );
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
