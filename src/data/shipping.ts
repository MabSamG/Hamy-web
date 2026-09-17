export type ZonaEnvio = "peninsula" | "baleares" | "canarias" | "recogida";

export type OpcionZona = {
  value: ZonaEnvio;
  label: string;
};

export const ZONAS_ENVIO: OpcionZona[] = [
  { value: "peninsula", label: "Envío a Península" },
  { value: "baleares", label: "Envío a Baleares" },
  { value: "canarias", label: "Envío a Canarias" },
  { value: "recogida", label: "Recogida en Elche" },
];

export function zonaLabel(zona: string): string {
  return ZONAS_ENVIO.find((z) => z.value === zona)?.label ?? zona;
}

/** Caja/sobre + relleno — se suma siempre al peso de los productos, sin depender del pedido. */
export const PESO_EMBALAJE_GRAMOS = 20;

type TramoPeso = { maxGramos: number; priceCents: number };

/** Tramos de Paq Ligero de Correos por zona. Tope de 2kg — por encima, se consulta aparte. */
const TRAMOS_ENVIO: Record<Exclude<ZonaEnvio, "recogida">, TramoPeso[]> = {
  peninsula: [
    { maxGramos: 250, priceCents: 600 },
    { maxGramos: 500, priceCents: 750 },
    { maxGramos: 1000, priceCents: 1050 },
    { maxGramos: 2000, priceCents: 1250 },
  ],
  baleares: [
    { maxGramos: 250, priceCents: 800 },
    { maxGramos: 500, priceCents: 1000 },
    { maxGramos: 1000, priceCents: 1400 },
    { maxGramos: 2000, priceCents: 1600 },
  ],
  canarias: [
    { maxGramos: 250, priceCents: 1200 },
    { maxGramos: 500, priceCents: 1400 },
    { maxGramos: 1000, priceCents: 1550 },
    { maxGramos: 2000, priceCents: 1900 },
  ],
};

/** Máximo peso que cubren los tramos anteriores; por encima hay que consultar aparte. */
export const PESO_MAXIMO_GRAMOS = 2000;

export type CalculoEnvio = { ok: true; priceCents: number } | { ok: false };

export function calcularEnvio(zona: ZonaEnvio, pesoTotalGramos: number): CalculoEnvio {
  if (zona === "recogida") return { ok: true, priceCents: 0 };

  const tramo = TRAMOS_ENVIO[zona].find((t) => pesoTotalGramos <= t.maxGramos);
  if (!tramo) return { ok: false };
  return { ok: true, priceCents: tramo.priceCents };
}
