export type ZonaEnvio = "peninsula" | "baleares" | "canarias" | "recogida";

export type OpcionEnvio = {
  value: ZonaEnvio;
  label: string;
  priceCents: number;
};

export const OPCIONES_ENVIO: OpcionEnvio[] = [
  { value: "peninsula", label: "Envío a Península", priceCents: 750 },
  { value: "baleares", label: "Envío a Baleares", priceCents: 1000 },
  { value: "canarias", label: "Envío a Canarias", priceCents: 1400 },
  { value: "recogida", label: "Recogida en persona", priceCents: 0 },
];

export function getOpcionEnvio(zona: string): OpcionEnvio | undefined {
  return OPCIONES_ENVIO.find((opcion) => opcion.value === zona);
}

export function envioLabel(zona: string): string {
  return getOpcionEnvio(zona)?.label ?? zona;
}
