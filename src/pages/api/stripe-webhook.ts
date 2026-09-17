import type { APIRoute } from "astro";
import type Stripe from "stripe";
import { getStripe } from "../../lib/stripe";
import { getSupabaseAdmin } from "../../lib/supabaseAdmin";

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
      const { data: pedido, error: updateError } = await supabaseAdmin
        .from("pedidos")
        .update({
          pago_estado: "pagado",
          stripe_payment_intent_id:
            typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null),
        })
        .eq("id", pedidoId)
        .select("id, referencia, cliente_nombre, cliente_email, total_cents, items")
        .maybeSingle();

      if (updateError) {
        console.error("No se pudo marcar el pedido como pagado:", updateError);
      } else if (pedido) {
        // Only now — payment confirmed — do we alert the admin by email,
        // so abandoned/cancelled checkouts stay silent.
        fetch(`${new URL(request.url).origin}/api/notify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "pedido",
            pedidoId: pedido.id,
            clienteNombre: pedido.cliente_nombre,
            clienteEmail: pedido.cliente_email,
            totalCents: pedido.total_cents,
            itemCount: Array.isArray(pedido.items) ? pedido.items.length : 0,
          }),
        }).catch(() => {});
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
