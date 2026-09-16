export type PersonalizationFieldType = "text" | "photo" | "date" | "time" | "number";

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

export type PersonalizationTemplate = {
  id: string;
  label: string;
  groups: PersonalizationGroup[];
};

/**
 * Reusable personalization shapes offered when creating a product from the
 * admin panel. Each product's actual `personalizacion` lives in Supabase
 * (see supabase/schema.sql) — these templates just seed a new product with
 * one of the same shapes the 4 existing products already use.
 */
export const PERSONALIZATION_TEMPLATES: PersonalizationTemplate[] = [
  {
    id: "solo-texto",
    label: "Solo texto",
    groups: [
      {
        id: "texto",
        label: "Personalización",
        fields: [{ id: "texto", label: "Texto o nombre", type: "text", required: true, maxLength: 30 }],
      },
    ],
  },
  {
    id: "solo-foto",
    label: "Solo foto",
    groups: [
      {
        id: "foto",
        label: "Foto",
        fields: [{ id: "foto", label: "Sube la foto", type: "photo", required: true }],
      },
    ],
  },
  {
    id: "texto-y-foto",
    label: "Texto y foto",
    groups: [
      {
        id: "personalizacion",
        label: "Personalización",
        fields: [
          { id: "texto", label: "Texto o nombre", type: "text", required: false, maxLength: 30 },
          { id: "foto", label: "Foto", type: "photo", required: false },
        ],
      },
    ],
  },
  {
    id: "dos-caras",
    label: "Dos caras (texto y/o foto en cada una)",
    groups: [
      {
        id: "cara-1",
        label: "Cara 1",
        fields: [
          { id: "texto", label: "Texto (opcional)", type: "text", required: false, maxLength: 40 },
          { id: "foto", label: "Foto (opcional)", type: "photo", required: false },
        ],
      },
      {
        id: "cara-2",
        label: "Cara 2",
        fields: [
          { id: "texto", label: "Texto (opcional)", type: "text", required: false, maxLength: 40 },
          { id: "foto", label: "Foto (opcional)", type: "photo", required: false },
        ],
      },
    ],
  },
];
