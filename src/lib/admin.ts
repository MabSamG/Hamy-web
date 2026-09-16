import { supabase } from "./supabase";
import type { PersonalizationGroup } from "../data/personalization";

export type PedidoEstado = "recibido" | "preparando" | "enviado";

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
  creado_en: string;
  estado: PedidoEstado;
  cliente_nombre: string;
  cliente_email: string;
  cliente_telefono: string | null;
  cliente_direccion: string | null;
  items: PedidoItem[];
  total_cents: number;
  notas: string | null;
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
};

const PRODUCTO_ADMIN_COLUMNS =
  "id, slug, nombre, categoria, categorias, precio_base, descripcion_corta, descripcion, emoji, imagen_principal, stock, destacado";

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
