export type PersonalizationFieldType = "text" | "photo" | "date" | "number";

export type PersonalizationField = {
  id: string;
  label: string;
  type: PersonalizationFieldType;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  maxLength?: number;
};

/** A group of fields, e.g. "Datos del bebé" or "Cara 1" for two-sided pieces. */
export type PersonalizationGroup = {
  id: string;
  label: string;
  fields: PersonalizationField[];
};

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
  /** Path under /public once real photos are supplied. */
  image?: string;
};

export const products: Product[] = [
  {
    slug: "llavero-de-bebe",
    name: "Llavero de bebé",
    category: "recuerdos-personalizados",
    categories: ["recuerdos-personalizados", "llaveros"],
    priceCents: 1200,
    shortDescription: "Un recuerdo tierno con la foto de tu bebé.",
    description:
      "Llavero artesanal en resina con la fotografía de tu bebé y sus datos de nacimiento, para llevar ese recuerdo siempre contigo.",
    featured: true,
    emoji: "👶",
    personalization: [
      {
        id: "foto",
        label: "Foto del bebé",
        fields: [
          {
            id: "foto-bebe",
            label: "Sube la foto",
            type: "photo",
            required: true,
            helpText: "Preferiblemente con buena luz y fondo sencillo.",
          },
        ],
      },
      {
        id: "datos",
        label: "Datos del bebé",
        fields: [
          { id: "nombre", label: "Nombre", type: "text", required: true, maxLength: 30 },
          { id: "fecha", label: "Fecha de nacimiento", type: "date", required: true },
          {
            id: "peso",
            label: "Peso al nacer",
            type: "text",
            required: false,
            placeholder: "Ej. 3,250 kg",
          },
        ],
      },
    ],
  },
  {
    slug: "marcapaginas-personalizado",
    name: "Marcapáginas Personalizado",
    category: "puntos-de-libro",
    categories: ["puntos-de-libro"],
    priceCents: 800,
    shortDescription: "El punto de libro perfecto con tu nombre o frase favorita.",
    description:
      "Marcapáginas de resina hecho a mano, personalizado con el texto que elijas: tu nombre, una frase o una dedicatoria.",
    featured: true,
    emoji: "📖",
    personalization: [
      {
        id: "texto",
        label: "Personalización",
        fields: [
          {
            id: "texto-marcapaginas",
            label: "Texto o nombre",
            type: "text",
            required: true,
            maxLength: 25,
            placeholder: "Ej. Marta",
          },
        ],
      },
    ],
  },
  {
    slug: "llavero-de-letra",
    name: "Llavero de letra",
    category: "llaveros",
    categories: ["llaveros"],
    priceCents: 350,
    shortDescription: "Tu inicial o un nombre corto, en resina y color a elegir.",
    description:
      "Llavero de resina con la letra o nombre corto que elijas. Ideal para regalar o combinar con las llaves de toda la familia.",
    featured: true,
    emoji: "🔑",
    personalization: [
      {
        id: "texto",
        label: "Personalización",
        fields: [
          {
            id: "texto-llavero",
            label: "Letra o nombre corto",
            type: "text",
            required: true,
            maxLength: 10,
            placeholder: "Ej. M",
          },
        ],
      },
    ],
  },
  {
    slug: "corazon-personalizado",
    name: "Corazón personalizado",
    category: "decoracion",
    categories: ["decoracion", "recuerdos-personalizados"],
    priceCents: 2000,
    shortDescription: "Pieza con soporte y dos caras, cada una a tu gusto.",
    description:
      "Corazón de resina con soporte de exhibición. Cada una de sus dos caras se puede personalizar con texto, foto o ambos, para crear una pieza decorativa totalmente única.",
    featured: true,
    emoji: "💗",
    personalization: [
      {
        id: "cara-1",
        label: "Cara 1",
        fields: [
          { id: "cara1-texto", label: "Texto (opcional)", type: "text", required: false, maxLength: 40 },
          { id: "cara1-foto", label: "Foto (opcional)", type: "photo", required: false },
        ],
      },
      {
        id: "cara-2",
        label: "Cara 2",
        fields: [
          { id: "cara2-texto", label: "Texto (opcional)", type: "text", required: false, maxLength: 40 },
          { id: "cara2-foto", label: "Foto (opcional)", type: "photo", required: false },
        ],
      },
    ],
  },
];

export function getProduct(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
  });
}
