import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { calcularResumenVentas, construirCsvResumenVentas, type PedidoParaResumen } from "../../src/lib/ventas";

// No reutiliza src/lib/supabaseAdmin.ts a propósito: ese helper lee las env
// vars vía `import.meta.env`, que solo funciona dentro del pipeline de Vite
// (Astro). Esta función la empaqueta el bundler de Netlify Functions
// (esbuild puro, sin Vite), así que aquí hace falta `process.env` directo.

// Se ejecuta cada lunes a las 6:00 UTC (Netlify Scheduled Functions usan UTC
// siempre) y genera el resumen de la semana anterior (lunes a domingo),
// enviándolo por email a somos.hamy@gmail.com vía Resend con el CSV adjunto.
// Mismo cálculo que la pestaña "Ventas" del admin (src/lib/ventas.ts,
// compartido), aquí con acceso de servicio (sin sesión de admin logueado).
//
// IMPORTANTE: las funciones programadas de Netlify solo se ejecutan una vez
// el sitio está desplegado — no se disparan con `npm run dev` en local. Ver
// el README ("Informe semanal de ventas automático") para la configuración
// necesaria tras el despliegue.
export const config: Config = {
  schedule: "0 6 * * 1",
};

const DESTINATARIO = "somos.hamy@gmail.com";

function formatFechaCorta(d: Date): string {
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

export default async () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("informe-semanal: falta RESEND_API_KEY, no se puede enviar el email.");
    return new Response("Falta RESEND_API_KEY", { status: 200 });
  }

  // Semana pasada: del lunes al domingo anteriores al lunes de hoy (que es
  // cuando se dispara el cron).
  const hoy = new Date();
  hoy.setUTCHours(0, 0, 0, 0);
  const finPeriodo = new Date(hoy.getTime() - 1); // domingo pasado, 23:59:59.999
  const inicioPeriodo = new Date(finPeriodo);
  inicioPeriodo.setUTCDate(inicioPeriodo.getUTCDate() - 6);
  inicioPeriodo.setUTCHours(0, 0, 0, 0);

  const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("informe-semanal: faltan PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY.");
    return new Response("Faltan variables de entorno de Supabase", { status: 200 });
  }

  let resumen;
  try {
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: pedidos, error } = await supabaseAdmin
      .from("pedidos")
      .select("creado_en, total_cents, cliente_email, items");
    if (error) throw new Error(error.message);

    resumen = calcularResumenVentas((pedidos ?? []) as PedidoParaResumen[], inicioPeriodo.getTime(), finPeriodo.getTime());
  } catch (err) {
    console.error("informe-semanal: no se pudo calcular el resumen:", err);
    return new Response("Error calculando el resumen", { status: 200 });
  }

  const etiquetaDesde = formatFechaCorta(inicioPeriodo);
  const etiquetaHasta = formatFechaCorta(finPeriodo);
  const csv = construirCsvResumenVentas(resumen, etiquetaDesde, etiquetaHasta);
  const csvBase64 = Buffer.from(`﻿${csv}`, "utf-8").toString("base64");

  const html = `
    <p><strong>Resumen de ventas — semana del ${etiquetaDesde} al ${etiquetaHasta}</strong></p>
    <ul>
      <li><strong>Total facturado:</strong> ${formatPrice(resumen.totalFacturadoCents)}</li>
      <li><strong>Pedidos:</strong> ${resumen.numPedidos}</li>
      <li><strong>Clientes nuevos:</strong> ${resumen.clientesNuevos}</li>
    </ul>
    <p><strong>Productos más vendidos:</strong></p>
    <ol>
      ${
        resumen.productosTop.length > 0
          ? resumen.productosTop.map((p) => `<li>${p.nombre} — ${p.cantidad} uds.</li>`).join("")
          : "<li>Sin ventas esta semana.</li>"
      }
    </ol>
    <p>Detalle completo adjunto en CSV.</p>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Hamy <onboarding@resend.dev>",
        to: DESTINATARIO,
        subject: `📊 Resumen de ventas: semana del ${etiquetaDesde} al ${etiquetaHasta}`,
        html,
        attachments: [
          {
            filename: `hamy-informe-semana-${inicioPeriodo.toISOString().slice(0, 10)}.csv`,
            content: csvBase64,
          },
        ],
      }),
    });
    if (!res.ok) {
      console.error("informe-semanal: Resend devolvió un error:", res.status, await res.text());
    }
  } catch (err) {
    console.error("informe-semanal: error llamando a Resend:", err);
  }

  return new Response("ok", { status: 200 });
};
