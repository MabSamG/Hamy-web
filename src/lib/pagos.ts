import type { SupabaseClient } from "@supabase/supabase-js";

// Shared by the Stripe webhook and the pedido-confirmado fallback check —
// both need to flip pago_estado to "pagado" exactly once and send the same
// admin email, whichever of the two gets there first. The eq("pago_estado",
// "pendiente") makes this idempotent: if the other path already marked it
// pagado, this update matches zero rows and we skip the notification.
export async function marcarPedidoComoPagado(
  supabaseAdmin: SupabaseClient,
  pedidoId: string,
  paymentIntentId: string | null,
  origin: string
): Promise<void> {
  const { data: pedido, error } = await supabaseAdmin
    .from("pedidos")
    .update({ pago_estado: "pagado", stripe_payment_intent_id: paymentIntentId })
    .eq("id", pedidoId)
    .eq("pago_estado", "pendiente")
    .select("id, referencia, cliente_nombre, cliente_email, total_cents, items")
    .maybeSingle();

  if (error) {
    console.error("No se pudo marcar el pedido como pagado:", error);
    return;
  }
  if (!pedido) return;

  fetch(`${origin}/api/notify`, {
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
