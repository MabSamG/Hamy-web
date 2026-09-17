import type { APIRoute } from "astro";
import { getStripe } from "../../lib/stripe";
import { getSupabaseAdmin } from "../../lib/supabaseAdmin";
import { calcularEnvio, PESO_EMBALAJE_GRAMOS, zonaLabel, type ZonaEnvio } from "../../data/shipping";

// This route opts out of prerendering so it can call Stripe/Supabase with
// secret keys server-side. It creates a Stripe Checkout Session for a pedido
// that already exists in Supabase (inserted client-side, estado "recibido",
// pago_estado "pendiente") and returns the URL to redirect the customer to.
export const prerender = false;

type PedidoRow = {
  id: string;
  referencia: string;
  cliente_email: string;
  cliente_nombre: string;
  zona_envio: ZonaEnvio;
  pago_estado: string;
  items: { producto_slug: string; producto_nombre: string; cantidad: number; precio_unitario_cents: number }[];
};

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request }) => {
  let pedidoId: string;
  try {
    const body = await request.json();
    pedidoId = body.pedidoId;
    if (!pedidoId || typeof pedidoId !== "string") throw new Error("missing pedidoId");
  } catch {
    return jsonError("Falta el identificador del pedido.");
  }

  let stripe: ReturnType<typeof getStripe>;
  let supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  try {
    stripe = getStripe();
    supabaseAdmin = getSupabaseAdmin();
  } catch (err) {
    console.error("Stripe/Supabase admin no configurado:", err);
    return jsonError("El pago online no está disponible todavía. Contáctanos para coordinar el pago.", 500);
  }

  const { data: pedido, error: fetchError } = await supabaseAdmin
    .from("pedidos")
    .select("id, referencia, cliente_email, cliente_nombre, zona_envio, pago_estado, items")
    .eq("id", pedidoId)
    .maybeSingle<PedidoRow>();

  if (fetchError || !pedido) {
    return jsonError("No se encontró el pedido.", 404);
  }
  if (pedido.pago_estado === "pagado") {
    return jsonError("Este pedido ya está pagado.");
  }

  // Recompute prices/weight from the live catalog rather than trusting the
  // amounts the client sent when it inserted the pedido — the insert only
  // checks estado = 'recibido' in RLS, not the prices, so this is the one
  // place that must be authoritative before real money changes hands.
  const slugs = [...new Set(pedido.items.map((item) => item.producto_slug))];
  const { data: productos, error: productosError } = await supabaseAdmin
    .from("productos")
    .select("slug, nombre, precio_base, peso_gramos")
    .in("slug", slugs);

  if (productosError) {
    console.error("Error cargando productos para el pago:", productosError);
    return jsonError("No se pudo preparar el pago. Inténtalo de nuevo.", 500);
  }

  const productosBySlug = new Map((productos ?? []).map((p) => [p.slug, p]));

  const lineItems: { price_data: { currency: string; product_data: { name: string }; unit_amount: number }; quantity: number }[] = [];
  let subtotalCents = 0;
  let pesoTotalGramos = PESO_EMBALAJE_GRAMOS;

  for (const item of pedido.items) {
    // Fall back to the price/weight stored on the pedido item if the product
    // was since deleted from the catalog — better than failing the payment
    // outright for an order that was already accepted.
    const producto = productosBySlug.get(item.producto_slug);
    const unitAmount = producto?.precio_base ?? item.precio_unitario_cents;
    const nombre = producto?.nombre ?? item.producto_nombre;
    const pesoGramos = producto?.peso_gramos ?? 0;

    subtotalCents += unitAmount * item.cantidad;
    pesoTotalGramos += pesoGramos * item.cantidad;

    lineItems.push({
      price_data: { currency: "eur", product_data: { name: nombre }, unit_amount: unitAmount },
      quantity: item.cantidad,
    });
  }

  const envio = calcularEnvio(pedido.zona_envio, pesoTotalGramos);
  if (!envio.ok) {
    return jsonError("Tu pedido supera el peso máximo cubierto por el envío automático. Contáctanos para coordinarlo.");
  }
  if (envio.priceCents > 0) {
    lineItems.push({
      price_data: {
        currency: "eur",
        product_data: { name: `Envío · ${zonaLabel(pedido.zona_envio)}` },
        unit_amount: envio.priceCents,
      },
      quantity: 1,
    });
  }

  const totalCents = subtotalCents + envio.priceCents;

  const { error: updateError } = await supabaseAdmin
    .from("pedidos")
    .update({
      subtotal_cents: subtotalCents,
      peso_total_gramos: pesoTotalGramos,
      envio_cents: envio.priceCents,
      total_cents: totalCents,
    })
    .eq("id", pedido.id);

  if (updateError) {
    console.error("Error actualizando totales del pedido antes del pago:", updateError);
    return jsonError("No se pudo preparar el pago. Inténtalo de nuevo.", 500);
  }

  const origin = new URL(request.url).origin;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: pedido.cliente_email,
    line_items: lineItems,
    locale: "es",
    success_url: `${origin}/pedido-confirmado?referencia=${encodeURIComponent(pedido.referencia)}`,
    cancel_url: `${origin}/carrito?pago=cancelado`,
    metadata: { pedido_id: pedido.id, referencia: pedido.referencia },
  });

  if (!session.url) {
    return jsonError("No se pudo iniciar el pago. Inténtalo de nuevo.", 500);
  }

  await supabaseAdmin.from("pedidos").update({ stripe_session_id: session.id }).eq("id", pedido.id);

  return new Response(JSON.stringify({ url: session.url }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
