import type { APIRoute } from "astro";
import { getStripe } from "../../lib/stripe";
import { getSupabaseAdmin } from "../../lib/supabaseAdmin";
import { marcarPedidoComoPagado } from "../../lib/pagos";

// Fallback for stripe-webhook.ts: the customer only reaches /pedido-confirmado
// after Stripe redirects them back on a *successful* payment, so that page
// calls this route to double-check directly with Stripe's API and self-heal
// pago_estado in case the webhook was delayed, misconfigured, or never
// arrived — otherwise a paid pedido could stay stuck as "pendiente" in
// /admin indefinitely.
export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  let referencia: string;
  try {
    const body = await request.json();
    referencia = body.referencia;
    if (!referencia || typeof referencia !== "string") throw new Error("missing referencia");
  } catch {
    return new Response(JSON.stringify({ error: "Falta la referencia." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let stripe: ReturnType<typeof getStripe>;
  let supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  try {
    stripe = getStripe();
    supabaseAdmin = getSupabaseAdmin();
  } catch (err) {
    console.error("Stripe/Supabase admin no configurado:", err);
    return new Response(JSON.stringify({ ok: false }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: pedido, error } = await supabaseAdmin
    .from("pedidos")
    .select("id, pago_estado, stripe_session_id")
    .eq("referencia", referencia)
    .maybeSingle();

  if (error || !pedido || pedido.pago_estado === "pagado" || !pedido.stripe_session_id) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(pedido.stripe_session_id);
    if (session.payment_status === "paid") {
      await marcarPedidoComoPagado(
        supabaseAdmin,
        pedido.id,
        typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null),
        new URL(request.url).origin
      );
    }
  } catch (err) {
    console.error("No se pudo verificar el pago con Stripe:", err);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
