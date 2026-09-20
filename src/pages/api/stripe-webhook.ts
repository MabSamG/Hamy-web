import type { APIRoute } from "astro";
import type Stripe from "stripe";
import { getStripe } from "../../lib/stripe";
import { getSupabaseAdmin } from "../../lib/supabaseAdmin";
import { marcarPedidoComoPagado } from "../../lib/pagos";

// Stripe calls this route directly (not the browser), so it needs the raw
// request body untouched to verify the signature — this route must stay
// server-rendered, same reason as crear-pago.ts and notify.ts.
export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const webhookSecret = import.meta.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");

  if (!webhookSecret || !signature) {
    return new Response("Webhook no configurado.", { status: 500 });
  }

  const body = await request.text();

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Firma de webhook de Stripe inválida:", err);
    return new Response("Firma inválida.", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const pedidoId = session.metadata?.pedido_id;

    if (pedidoId) {
      const supabaseAdmin = getSupabaseAdmin();
      await marcarPedidoComoPagado(
        supabaseAdmin,
        pedidoId,
        typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null),
        new URL(request.url).origin
      );
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
