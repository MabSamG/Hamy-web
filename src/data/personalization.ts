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

/**
 * Form structure per product, keyed by product slug. This is UI shape, not
 * catalog data, so it lives in code rather than in the `productos` table —
 * it decides which inputs render on the product detail page.
 */
export const personalizationBySlug: Record<string, PersonalizationGroup[]> = {
  "llavero-de-bebe": [
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
  "marcapaginas-personalizado": [
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
  "llavero-de-letra": [
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
  "corazon-personalizado": [
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
};
