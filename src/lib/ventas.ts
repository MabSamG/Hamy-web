// Lógica de agregación compartida entre la pestaña "Ventas" del admin
// (fetch vía supabase-js con sesión de admin) y la Netlify Scheduled
// Function del informe semanal (fetch vía service role, sin sesión de
// usuario) — ambas calculan el mismo resumen a partir de la misma forma de
// datos, para no mantener la lógica duplicada en dos sitios.

export type PedidoParaResumen = {
  creado_en: string;
  total_cents: number;
  cliente_email: string;
  items: { producto_nombre: string; cantidad: number }[];
};

export type ResumenVentas = {
  totalFacturadoCents: number;
  numPedidos: number;
  productosTop: { nombre: string; cantidad: number }[];
  clientesNuevos: number;
};

/**
 * `pedidosTodos` debe incluir TODO el histórico, no solo los del periodo:
 * para saber si un cliente es "nuevo en el periodo" hace falta conocer la
 * fecha de su primer pedido de siempre, no solo los pedidos dentro del rango.
 */
export function calcularResumenVentas(pedidosTodos: PedidoParaResumen[], desdeTs: number, hastaTs: number): ResumenVentas {
  const pedidosPeriodo = pedidosTodos.filter((p) => {
    const t = new Date(p.creado_en).getTime();
    return t >= desdeTs && t <= hastaTs;
  });

  const totalFacturadoCents = pedidosPeriodo.reduce((sum, p) => sum + p.total_cents, 0);

  const productoCount = new Map<string, number>();
  for (const pedido of pedidosPeriodo) {
    for (const item of pedido.items ?? []) {
      productoCount.set(item.producto_nombre, (productoCount.get(item.producto_nombre) ?? 0) + item.cantidad);
    }
  }
  const productosTop = [...productoCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([nombre, cantidad]) => ({ nombre, cantidad }));

  const primeraCompraPorEmail = new Map<string, number>();
  for (const pedido of pedidosTodos) {
    const email = pedido.cliente_email.trim().toLowerCase();
    const t = new Date(pedido.creado_en).getTime();
    const actual = primeraCompraPorEmail.get(email);
    if (actual === undefined || t < actual) primeraCompraPorEmail.set(email, t);
  }
  const clientesNuevos = [...primeraCompraPorEmail.values()].filter((t) => t >= desdeTs && t <= hastaTs).length;

  return {
    totalFacturadoCents,
    numPedidos: pedidosPeriodo.length,
    productosTop,
    clientesNuevos,
  };
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function construirCsvResumenVentas(resumen: ResumenVentas, etiquetaDesde: string, etiquetaHasta: string): string {
  const lines: string[] = [];
  lines.push(`Resumen de ventas: ${etiquetaDesde} a ${etiquetaHasta}`);
  lines.push("Métrica,Valor");
  lines.push(`Total facturado (EUR),${(resumen.totalFacturadoCents / 100).toFixed(2)}`);
  lines.push(`Número de pedidos,${resumen.numPedidos}`);
  lines.push(`Clientes nuevos,${resumen.clientesNuevos}`);
  lines.push("");
  lines.push("Productos más vendidos,Unidades");
  if (resumen.productosTop.length === 0) {
    lines.push("(sin ventas en el periodo),0");
  } else {
    for (const p of resumen.productosTop) {
      lines.push(`${csvEscape(p.nombre)},${p.cantidad}`);
    }
  }
  return lines.join("\n");
}
