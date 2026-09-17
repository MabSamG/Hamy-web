// Agente virtual del widget de chat: respuestas predefinidas por
// coincidencia de palabras clave sobre texto libre. Deliberadamente NO
// llama a ningun LLM (evita costes de API recurrentes) — mismo enfoque
// que el agente del sitio de 3G.

export type ChatEnlace = { href: string; label: string };

export type ChatRespuesta = {
  texto: string;
  enlace?: ChatEnlace;
};

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

type Regla = {
  palabrasClave: string[];
  respuesta: ChatRespuesta;
};

// El orden importa: las reglas mas especificas (estado de pedido, costes de
// envio por zona) van antes que las genericas ("envio", "pedido") para que
// no las tapen coincidencias mas amplias.
const REGLAS: Regla[] = [
  {
    palabrasClave: ["estado de mi pedido", "donde esta mi pedido", "seguimiento", "rastrear", "en que va mi pedido", "mi pedido"],
    respuesta: {
      texto: "Puedes consultar el estado de tu pedido con tu número de referencia y tu email.",
      enlace: { href: "/mi-pedido", label: "Consultar mi pedido" },
    },
  },
  {
    palabrasClave: [
      "cuanto cuesta el envio",
      "precio del envio",
      "coste del envio",
      "gastos de envio",
      "tarifa de envio",
      "cuanto cuesta enviar",
      "envio a peninsula",
      "envio a baleares",
      "envio a canarias",
      "zona de envio",
      "zonas de envio",
      "recogida en elche",
      "recoger en elche",
      "recogida gratis",
    ],
    respuesta: {
      texto:
        "Los costes de envío son: Península 7,50 €, Baleares 10 €, Canarias 14 €. También puedes recoger tu pedido gratis en Elche.",
    },
  },
  {
    palabrasClave: ["cuanto tarda", "tiempo de envio", "tiempo de entrega", "cuando llega", "cuando me llega", "plazo de envio", "dias de envio"],
    respuesta: {
      texto: "Los envíos salen en 5-7 días desde que la pieza está terminada (cada pieza se hace a mano y bajo pedido).",
    },
  },
  {
    palabrasClave: ["personalizacion", "personalizar", "tiempo de fabricacion", "cuanto tardan en hacer", "cuanto se tarda en personalizar"],
    respuesta: {
      texto:
        "El tiempo de personalización depende de la pieza y de la cantidad que pidas. Contáctanos y te damos un plazo exacto para tu caso.",
    },
  },
  {
    palabrasClave: ["evento", "boda", "comunion", "bautizo", "encargo grande", "por volumen", "muchas unidades", "cantidad grande", "detalle para invitados"],
    respuesta: {
      texto: "Para bodas, comuniones u otros encargos por volumen, cuéntanos los detalles y te preparamos un presupuesto.",
      enlace: { href: "/eventos", label: "Solicitar presupuesto" },
    },
  },
  {
    palabrasClave: ["como pido", "como compro", "como hago un pedido", "quiero comprar", "hacer un pedido", "catalogo", "ver productos", "donde compro"],
    respuesta: {
      texto: "Puedes hacer tu pedido directamente desde nuestro catálogo, eligiendo el producto y personalizándolo a tu gusto.",
      enlace: { href: "/productos", label: "Ver productos" },
    },
  },
  {
    palabrasClave: ["pago", "pagar", "tarjeta", "stripe", "metodo de pago", "metodos de pago", "como se paga", "formas de pago"],
    respuesta: {
      texto: "Aceptamos pago con tarjeta de forma segura a través de Stripe, directamente al finalizar tu pedido.",
    },
  },
];

const RESPUESTA_SALUDO: ChatRespuesta = {
  texto: "¡Hola! 👋 Soy el asistente virtual de Hamy. Puedo ayudarte con envíos, personalización, pedidos, pagos o eventos. ¿En qué puedo ayudarte?",
};

const RESPUESTA_SIN_COINCIDENCIA: ChatRespuesta = {
  texto: "No he sabido responder a eso con la información que tengo. Escríbenos por WhatsApp o por el formulario de contacto y te ayudamos encantados.",
  enlace: { href: "/contacto", label: "Ir a contacto" },
};

export function saludoInicial(): ChatRespuesta {
  return RESPUESTA_SALUDO;
}

export function responderMensaje(mensaje: string): { respuesta: ChatRespuesta; reconocido: boolean } {
  const normalizado = normalizar(mensaje);
  for (const regla of REGLAS) {
    if (regla.palabrasClave.some((palabra) => normalizado.includes(palabra))) {
      return { respuesta: regla.respuesta, reconocido: true };
    }
  }
  return { respuesta: RESPUESTA_SIN_COINCIDENCIA, reconocido: false };
}
