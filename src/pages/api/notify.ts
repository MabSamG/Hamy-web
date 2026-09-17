import type { APIRoute } from "astro";

// This route opts out of prerendering (the rest of the site stays static) so
// it can run server-side and call Resend with a secret API key that must
// never reach the client bundle.
export const prerender = false;

type NotifyPayload =
  | {
      type: "pedido";
      pedidoId: string;
      clienteNombre: string;
      clienteEmail: string;
      totalCents: number;
      itemCount: number;
    }
  | {
      type: "evento";
      clienteNombre: string;
      clienteEmail: string;
      clienteTelefono: string;
      productoInteres: string;
      cantidad: number;
      fechaEvento: string;
      fechaEntregaDeseada: string;
    }
  | {
      type: "contacto";
      nombre: string;
      email: string;
      mensaje: string;
    };

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

function buildEmail(payload: NotifyPayload, adminUrl: string): { subject: string; html: string } {
  switch (payload.type) {
    case "pedido":
      return {
        subject: `✅ Nuevo pedido pagado de ${payload.clienteNombre} · ${formatPrice(payload.totalCents)}`,
        html: `
          <p><strong>✅ Pago confirmado.</strong> Este pedido ya está pagado, recibido desde el carrito.</p>
          <ul>
            <li><strong>Estado del pago:</strong> Pagado</li>
            <li><strong>Cliente:</strong> ${payload.clienteNombre} (${payload.clienteEmail})</li>
            <li><strong>Artículos:</strong> ${payload.itemCount}</li>
            <li><strong>Total cobrado:</strong> ${formatPrice(payload.totalCents)}</li>
            <li><strong>Referencia:</strong> ${payload.pedidoId.slice(0, 8).toUpperCase()}</li>
          </ul>
          <p><a href="${adminUrl}">Ver el pedido completo en el panel de administración</a> (pestaña Pedidos).</p>
        `,
      };
    case "evento":
      return {
        subject: `Nueva consulta de evento: ${payload.productoInteres} x${payload.cantidad}`,
        html: `
          <p>Nueva consulta de encargo por volumen desde /eventos.</p>
          <ul>
            <li><strong>Cliente:</strong> ${payload.clienteNombre} (${payload.clienteEmail}, ${payload.clienteTelefono})</li>
            <li><strong>Producto de interés:</strong> ${payload.productoInteres}</li>
            <li><strong>Cantidad:</strong> ${payload.cantidad}</li>
            <li><strong>Fecha del evento:</strong> ${payload.fechaEvento}</li>
            <li><strong>Fecha de entrega deseada:</strong> ${payload.fechaEntregaDeseada}</li>
          </ul>
          <p><a href="${adminUrl}">Ver la consulta completa en el panel de administración</a> (pestaña Eventos).</p>
        `,
      };
    case "contacto":
      return {
        subject: `Nuevo mensaje de contacto de ${payload.nombre}`,
        html: `
          <p>Nuevo mensaje recibido desde /contacto.</p>
          <p><strong>De:</strong> ${payload.nombre} (${payload.email})</p>
          <p style="white-space: pre-wrap;">${payload.mensaje}</p>
          <p><a href="${adminUrl}">Ver el mensaje en el panel de administración</a> (pestaña Contacto).</p>
        `,
      };
  }
}

export const POST: APIRoute = async ({ request }) => {
  const apiKey = import.meta.env.RESEND_API_KEY;
  const to = import.meta.env.NOTIFICATION_EMAIL;

  // Not configured yet — the pedido/consulta/mensaje is already saved in
  // Supabase regardless of this endpoint, so silently skipping is correct,
  // not an error.
  if (!apiKey || !to) {
    return new Response(JSON.stringify({ ok: true, skipped: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const payload = (await request.json()) as NotifyPayload;
    const adminUrl = `${new URL(request.url).origin}/admin`;
    const { subject, html } = buildEmail(payload, adminUrl);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Hamy <onboarding@resend.dev>",
        to,
        subject,
        html,
      }),
    });

    if (!res.ok) {
      console.error("Resend notify failed:", res.status, await res.text());
    }
  } catch (err) {
    console.error("Resend notify error:", err);
  }

  // Always 200: a failed/misconfigured notification must never surface as an
  // error to the customer-facing form that triggered it.
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
