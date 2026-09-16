import { supabase } from "../lib/supabase";

export type Category = {
  slug: string;
  name: string;
  description: string;
  emoji: string;
};

type CategoriaRow = {
  slug: string;
  nombre: string;
  descripcion: string;
  emoji: string;
};

const CATEGORIA_COLUMNS = "slug, nombre, descripcion, emoji";

function mapRow(row: CategoriaRow): Category {
  return {
    slug: row.slug,
    name: row.nombre,
    description: row.descripcion,
    emoji: row.emoji,
  };
}

export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categorias")
    .select(CATEGORIA_COLUMNS)
    .order("creado_en", { ascending: true });

  if (error) throw new Error(`No se pudieron cargar las categorías: ${error.message}`);
  return (data ?? []).map(mapRow);
}

export async function getCategory(slug: string): Promise<Category | undefined> {
  const { data, error } = await supabase
    .from("categorias")
    .select(CATEGORIA_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(`No se pudo cargar la categoría "${slug}": ${error.message}`);
  return data ? mapRow(data) : undefined;
}
