/**
 * Minimal, dependency-free page-view tracker (no supabase-js import, so
 * public pages don't pay for that bundle just to log a visit). Talks to
 * Supabase's REST API directly with plain fetch.
 *
 * No cookies, no visitor id, no IP/user-agent capture — just: which route,
 * whether it was a product page, and how long the tab stayed open.
 */

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

function restHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

export function trackPageView(ruta: string, productoSlug: string | null): void {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;

  const tipo = productoSlug ? "producto_vista" : "pagina_vista";
  const startedAt = Date.now();
  let eventId: string | null = null;
  let durationSent = false;

  fetch(`${SUPABASE_URL}/rest/v1/analytics_eventos`, {
    method: "POST",
    headers: restHeaders({ Prefer: "return=representation" }),
    body: JSON.stringify({ tipo, ruta, producto_slug: productoSlug }),
    keepalive: true,
  })
    .then((res) => (res.ok ? res.json() : null))
    .then((rows) => {
      eventId = Array.isArray(rows) && rows[0]?.id ? rows[0].id : null;
    })
    .catch(() => {
      // Best-effort only — never let tracking break the page.
    });

  function sendDuration() {
    if (durationSent || !eventId) return;
    durationSent = true;
    const duracionMs = Date.now() - startedAt;
    fetch(`${SUPABASE_URL}/rest/v1/analytics_eventos?id=eq.${eventId}`, {
      method: "PATCH",
      headers: restHeaders({ Prefer: "return=minimal" }),
      body: JSON.stringify({ duracion_ms: duracionMs }),
      keepalive: true,
    }).catch(() => {});
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") sendDuration();
  });
  window.addEventListener("pagehide", sendDuration);
}
