import { supabase } from "./supabase";
import type { PersonalizationGroup } from "../data/personalization";

export type PedidoEstado = "recibido" | "preparando" | "enviado";
export type PagoEstado = "pendiente" | "pagado";

export type PedidoItemCampo = {
  label: string;
  valor?: string | null;
  foto?: string | null;
};

export type PedidoItemGrupo = {
  label: string;
  campos: Record<string, PedidoItemCampo>;
};

export type PedidoItem = {
  producto_slug: string;
  producto_nombre: string;
  cantidad: number;
  precio_unitario_cents: number;
  personalizacion: Record<string, PedidoItemGrupo>;
};

export type Pedido = {
  id: string;
  referencia: string;
  creado_en: string;
  estado: PedidoEstado;
  cliente_nombre: string;
  cliente_email: string;
  cliente_telefono: string | null;
  cliente_direccion: string | null;
  items: PedidoItem[];
  subtotal_cents: number;
  zona_envio: string;
  peso_total_gramos: number;
  envio_cents: number;
  total_cents: number;
  notas: string | null;
  pago_estado: PagoEstado;
};

export async function listPedidos(): Promise<Pedido[]> {
  const { data, error } = await supabase.from("pedidos").select("*").order("creado_en", { ascending: false });
  if (error) throw new Error(`No se pudieron cargar los pedidos: ${error.message}`);
  return (data ?? []) as Pedido[];
}

export async function updatePedidoEstado(id: string, estado: PedidoEstado): Promise<void> {
  const { error } = await supabase.from("pedidos").update({ estado }).eq("id", id);
  if (error) throw new Error(`No se pudo actualizar el estado: ${error.message}`);
}

/** Manual override — for pagos coordinados fuera de Stripe (efectivo en la recogida, transferencia...). */
export async function updatePedidoPagoEstado(id: string, pago_estado: PagoEstado): Promise<void> {
  const { error } = await supabase.from("pedidos").update({ pago_estado }).eq("id", id);
  if (error) throw new Error(`No se pudo actualizar el estado de pago: ${error.message}`);
}

/** Bucket is private, so photos need a signed URL rather than a public one. */
export async function getFotoUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from("fotos-pedidos").createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

export type ProductoAdmin = {
  id: string;
  slug: string;
  nombre: string;
  categoria: string;
  categorias: string[];
  precio_base: number;
  descripcion_corta: string;
  descripcion: string;
  emoji: string | null;
  imagen_principal: string | null;
  stock: number | null;
  destacado: boolean;
  peso_gramos: number;
};

const PRODUCTO_ADMIN_COLUMNS =
  "id, slug, nombre, categoria, categorias, precio_base, descripcion_corta, descripcion, emoji, imagen_principal, stock, destacado, peso_gramos";

export async function listProductosAdmin(): Promise<ProductoAdmin[]> {
  const { data, error } = await supabase
    .from("productos")
    .select(PRODUCTO_ADMIN_COLUMNS)
    .order("creado_en", { ascending: true });
  if (error) throw new Error(`No se pudo cargar el catálogo: ${error.message}`);
  return (data ?? []) as ProductoAdmin[];
}

export type ProductoUpdate = Partial<Omit<ProductoAdmin, "id" | "slug">>;

export async function updateProducto(id: string, patch: ProductoUpdate): Promise<void> {
  const { error } = await supabase.from("productos").update(patch).eq("id", id);
  if (error) throw new Error(`No se pudo guardar el producto: ${error.message}`);
}

export async function deleteProducto(id: string): Promise<void> {
  const { error } = await supabase.from("productos").delete().eq("id", id);
  if (error) throw new Error(`No se pudo borrar el producto: ${error.message}`);
}

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type NuevoProducto = {
  slug: string;
  nombre: string;
  categoria: string;
  categorias: string[];
  precio_base: number;
  descripcion_corta: string;
  descripcion: string;
  emoji: string | null;
  stock: number | null;
  destacado: boolean;
  personalizacion: PersonalizationGroup[];
  peso_gramos: number;
};

export async function createProducto(producto: NuevoProducto): Promise<void> {
  const { error } = await supabase.from("productos").insert(producto);
  if (error) throw new Error(`No se pudo crear el producto: ${error.message}`);
}

export type CategoriaAdmin = {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string;
  emoji: string;
};

export async function listCategoriasAdmin(): Promise<CategoriaAdmin[]> {
  const { data, error } = await supabase
    .from("categorias")
    .select("id, slug, nombre, descripcion, emoji")
    .order("creado_en", { ascending: true });
  if (error) throw new Error(`No se pudieron cargar las categorías: ${error.message}`);
  return (data ?? []) as CategoriaAdmin[];
}

export type NuevaCategoria = {
  slug: string;
  nombre: string;
  descripcion?: string;
  emoji?: string;
};

export async function createCategoria(categoria: NuevaCategoria): Promise<void> {
  const { error } = await supabase.from("categorias").insert({
    slug: categoria.slug,
    nombre: categoria.nombre,
    descripcion: categoria.descripcion ?? "",
    emoji: categoria.emoji ?? "✨",
  });
  if (error) throw new Error(`No se pudo crear la categoría: ${error.message}`);
}

export async function deleteCategoria(id: string): Promise<void> {
  const { error } = await supabase.from("categorias").delete().eq("id", id);
  if (error) throw new Error(`No se pudo borrar la categoría: ${error.message}`);
}

export type ConsultaEvento = {
  id: string;
  creado_en: string;
  cliente_nombre: string;
  cliente_email: string;
  cliente_telefono: string;
  producto_interes: string;
  cantidad: number;
  fecha_evento: string;
  fecha_entrega_deseada: string;
  imagen_referencia: string | null;
  descripcion: string;
  atendida: boolean;
};

export async function listConsultasEventos(): Promise<ConsultaEvento[]> {
  const { data, error } = await supabase.from("consultas_eventos").select("*").order("creado_en", { ascending: false });
  if (error) throw new Error(`No se pudieron cargar las consultas de eventos: ${error.message}`);
  return (data ?? []) as ConsultaEvento[];
}

export async function updateConsultaEventoAtendida(id: string, atendida: boolean): Promise<void> {
  const { error } = await supabase.from("consultas_eventos").update({ atendida }).eq("id", id);
  if (error) throw new Error(`No se pudo actualizar la consulta: ${error.message}`);
}

/** Bucket is private, so reference photos need a signed URL rather than a public one. */
export async function getFotoEventoUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from("fotos-eventos").createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

export type MensajeContacto = {
  id: string;
  creado_en: string;
  nombre: string;
  email: string;
  mensaje: string;
  atendido: boolean;
};

export async function listMensajesContacto(): Promise<MensajeContacto[]> {
  const { data, error } = await supabase.from("mensajes_contacto").select("*").order("creado_en", { ascending: false });
  if (error) throw new Error(`No se pudieron cargar los mensajes de contacto: ${error.message}`);
  return (data ?? []) as MensajeContacto[];
}

export async function updateMensajeContactoAtendido(id: string, atendido: boolean): Promise<void> {
  const { error } = await supabase.from("mensajes_contacto").update({ atendido }).eq("id", id);
  if (error) throw new Error(`No se pudo actualizar el mensaje: ${error.message}`);
}

export type LeadAgente = {
  id: string;
  creado_en: string;
  nombre: string;
  contacto: string;
  contexto: string | null;
  atendido: boolean;
};

export async function listLeadsAgente(): Promise<LeadAgente[]> {
  const { data, error } = await supabase.from("leads_agente").select("*").order("creado_en", { ascending: false });
  if (error) throw new Error(`No se pudieron cargar los contactos del agente: ${error.message}`);
  return (data ?? []) as LeadAgente[];
}

export async function updateLeadAgenteAtendido(id: string, atendido: boolean): Promise<void> {
  const { error } = await supabase.from("leads_agente").update({ atendido }).eq("id", id);
  if (error) throw new Error(`No se pudo actualizar el contacto: ${error.message}`);
}

export type AnalyticsEvento = {
  id: string;
  tipo: "pagina_vista" | "producto_vista";
  ruta: string;
  producto_slug: string | null;
  duracion_ms: number | null;
  creado_en: string;
};

/** Last 30 days only, capped at 5000 rows — enough for a small store's "estadísticas sencillas". */
export async function listAnalyticsRecientes(): Promise<AnalyticsEvento[]> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("analytics_eventos")
    .select("id, tipo, ruta, producto_slug, duracion_ms, creado_en")
    .gte("creado_en", since)
    .order("creado_en", { ascending: false })
    .limit(5000);
  if (error) throw new Error(`No se pudieron cargar las estadísticas: ${error.message}`);
  return (data ?? []) as AnalyticsEvento[];
}

export type Cliente = {
  /** Email normalizado (minúsculas) del pedido más reciente — clave para vincular las notas manuales. */
  clave: string;
  nombre: string;
  email: string;
  telefono: string | null;
  numPedidos: number;
  totalGastadoCents: number;
  ultimoPedidoEn: string;
  pedidos: Pedido[];
  etiquetas: string[];
};

function normalizarEmailCliente(email: string): string {
  return email.trim().toLowerCase();
}

function normalizarTelefonoCliente(telefono: string | null): string | null {
  if (!telefono) return null;
  const digitos = telefono.replace(/\D/g, "");
  return digitos.length >= 6 ? digitos : null;
}

function ufFind(uf: Map<string, string>, x: string): string {
  let root = x;
  while (uf.get(root) !== root) root = uf.get(root)!;
  let cur = x;
  while (uf.get(cur) !== root) {
    const next = uf.get(cur)!;
    uf.set(cur, root);
    cur = next;
  }
  return root;
}

function ufUnion(uf: Map<string, string>, a: string, b: string): void {
  if (!uf.has(a)) uf.set(a, a);
  if (!uf.has(b)) uf.set(b, b);
  const ra = ufFind(uf, a);
  const rb = ufFind(uf, b);
  if (ra !== rb) uf.set(ra, rb);
}

/**
 * Agrupa los pedidos existentes por cliente. La clave principal es el email,
 * pero si dos pedidos con emails distintos comparten el mismo teléfono se
 * agrupan igual (typo en el email, variante que no coincide, etc.).
 */
export async function listClientes(): Promise<Cliente[]> {
  const pedidos = await listPedidos();
  const uf = new Map<string, string>();

  for (const pedido of pedidos) {
    const emailKey = `email:${normalizarEmailCliente(pedido.cliente_email)}`;
    if (!uf.has(emailKey)) uf.set(emailKey, emailKey);
    const telNorm = normalizarTelefonoCliente(pedido.cliente_telefono);
    if (telNorm) ufUnion(uf, emailKey, `tel:${telNorm}`);
  }

  const grupos = new Map<string, Pedido[]>();
  for (const pedido of pedidos) {
    const emailKey = `email:${normalizarEmailCliente(pedido.cliente_email)}`;
    const root = ufFind(uf, emailKey);
    const lista = grupos.get(root) ?? [];
    lista.push(pedido);
    grupos.set(root, lista);
  }

  // Carga las etiquetas de todos los clientes de una vez (barato: una fila
  // por email en notas_clientes) en vez de una consulta por cliente.
  const etiquetasPorEmail = new Map<string, string[]>();
  const { data: notasRows, error: notasError } = await supabase.from("notas_clientes").select("email, etiquetas");
  if (!notasError) {
    for (const fila of notasRows ?? []) {
      etiquetasPorEmail.set(fila.email as string, (fila.etiquetas as string[]) ?? []);
    }
  }

  const clientes: Cliente[] = [];
  for (const pedidosCliente of grupos.values()) {
    // listPedidos() ya viene ordenado por creado_en descendente.
    const masReciente = pedidosCliente[0];
    const telefono = pedidosCliente.find((p) => p.cliente_telefono)?.cliente_telefono ?? null;
    const clave = normalizarEmailCliente(masReciente.cliente_email);
    clientes.push({
      clave,
      nombre: masReciente.cliente_nombre,
      email: masReciente.cliente_email,
      telefono,
      numPedidos: pedidosCliente.length,
      totalGastadoCents: pedidosCliente.reduce((sum, p) => sum + p.total_cents, 0),
      ultimoPedidoEn: masReciente.creado_en,
      pedidos: pedidosCliente,
      etiquetas: etiquetasPorEmail.get(clave) ?? [],
    });
  }

  return clientes;
}

export async function getNotaCliente(clave: string): Promise<string> {
  const { data, error } = await supabase.from("notas_clientes").select("notas").eq("email", clave).maybeSingle();
  if (error) throw new Error(`No se pudo cargar la nota del cliente: ${error.message}`);
  return data?.notas ?? "";
}

export async function guardarNotaCliente(clave: string, notas: string): Promise<void> {
  const { error } = await supabase
    .from("notas_clientes")
    .upsert({ email: clave, notas, actualizado_en: new Date().toISOString() });
  if (error) throw new Error(`No se pudo guardar la nota del cliente: ${error.message}`);
}

export async function guardarEtiquetasCliente(clave: string, etiquetas: string[]): Promise<void> {
  const { error } = await supabase
    .from("notas_clientes")
    .upsert({ email: clave, etiquetas, actualizado_en: new Date().toISOString() });
  if (error) throw new Error(`No se pudieron guardar las etiquetas: ${error.message}`);
}
