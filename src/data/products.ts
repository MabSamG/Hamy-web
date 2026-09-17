import { supabase } from "../lib/supabase";
import type { PersonalizationGroup } from "./personalization";

export type { PersonalizationField, PersonalizationFieldType, PersonalizationGroup } from "./personalization";

export type Product = {
  slug: string;
  name: string;
  /** Primary category slug, used for the main catalog badge. */
  category: string;
  /** All category slugs this product should appear under when filtering. */
  categories: string[];
  priceCents: number;
  shortDescription: string;
  description: string;
  featured: boolean;
  /** Emoji used as a placeholder visual until real product photos are added. */
  emoji: string;
  personalization: PersonalizationGroup[];
  /** Path/URL once real photos are supplied. */
  image?: string;
  /** Peso de la pieza en gramos, usado para calcular el envío por tramos de peso. */
  weightGrams: number;
};

type ProductoRow = {
  slug: string;
  nombre: string;
  categoria: string;
  categorias: string[] | null;
  precio_base: number;
  descripcion_corta: string;
  descripcion: string;
  destacado: boolean;
  emoji: string | null;
  imagen_principal: string | null;
  personalizacion: PersonalizationGroup[] | null;
  peso_gramos: number | null;
};

const PRODUCTO_COLUMNS =
  "slug, nombre, categoria, categorias, precio_base, descripcion_corta, descripcion, destacado, emoji, imagen_principal, personalizacion, peso_gramos";

function mapRow(row: ProductoRow): Product {
  return {
    slug: row.slug,
    name: row.nombre,
    category: row.categoria,
    categories: row.categorias?.length ? row.categorias : [row.categoria],
    priceCents: row.precio_base,
    shortDescription: row.descripcion_corta,
    description: row.descripcion,
    featured: row.destacado,
    emoji: row.emoji ?? "✨",
    image: row.imagen_principal ?? undefined,
    personalization: row.personalizacion ?? [],
    weightGrams: row.peso_gramos ?? 0,
  };
}

export async function getProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("productos")
    .select(PRODUCTO_COLUMNS)
    .order("creado_en", { ascending: true });

  if (error) throw new Error(`No se pudieron cargar los productos: ${error.message}`);
  return (data ?? []).map(mapRow);
}

export async function getProduct(slug: string): Promise<Product | undefined> {
  const { data, error } = await supabase
    .from("productos")
    .select(PRODUCTO_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(`No se pudo cargar el producto "${slug}": ${error.message}`);
  return data ? mapRow(data) : undefined;
}

export function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
  });
}
