export type Category = {
  slug: string;
  name: string;
  description: string;
  emoji: string;
};

export const categories: Category[] = [
  {
    slug: "llaveros",
    name: "Llaveros",
    description: "Pequeños detalles para llevar siempre contigo.",
    emoji: "🔑",
  },
  {
    slug: "puntos-de-libro",
    name: "Puntos de libro",
    description: "Marcapáginas únicos para los amantes de la lectura.",
    emoji: "📖",
  },
  {
    slug: "decoracion",
    name: "Decoración",
    description: "Piezas artesanales para dar vida a tus espacios.",
    emoji: "🏡",
  },
  {
    slug: "recuerdos-personalizados",
    name: "Recuerdos personalizados",
    description: "Momentos únicos convertidos en piezas para siempre.",
    emoji: "💞",
  },
];

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}
