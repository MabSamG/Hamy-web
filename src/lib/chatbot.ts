// Agente virtual del widget de chat ("Daniela"): respuestas predefinidas
// por coincidencia de palabras clave sobre texto libre. Deliberadamente NO
// llama a ningun LLM (evita costes de API recurrentes) — mismo enfoque
// que el agente del sitio de 3G.
//
// Para añadir una intencion nueva: añade una entrada mas a REGLAS con sus
// palabrasClave (variaciones normalizadas, sin acentos) y su respuesta. El
// orden importa — la primera regla cuyas palabras clave coincidan gana, asi
// que las mas especificas deben ir antes que las genericas.

export type ChatEnlace = { href: string; label: string };

export type ChatRespuesta = {
  texto: string;
  enlaces?: ChatEnlace[];
  /** true para respuestas de cierre (agradecimiento/despedida): no debe disparar la captura de contacto. */
  esDespedida?: boolean;
};

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Coincidencia por límite de palabra (no solo substring), para que p. ej. "vale" no case dentro de "valentina". */
function contienePalabraClave(normalizado: string, palabraClave: string): boolean {
  const escapada = palabraClave.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escapada}\\b`).test(normalizado);
}

type Regla = {
  palabrasClave: string[];
  respuesta: ChatRespuesta;
};

const REGLAS: Regla[] = [
  // --- Estado de un pedido ya hecho ---
  {
    palabrasClave: ["estado de mi pedido", "donde esta mi pedido", "seguimiento", "rastrear", "en que va mi pedido", "mi pedido"],
    respuesta: {
      texto: "¡Claro! Con tu número de referencia y el email que usaste al pedir puedes ver en qué punto va tu pedido aquí:",
      enlaces: [{ href: "/mi-pedido", label: "Consultar mi pedido" }],
    },
  },

  // --- Envío: zonas y costes (mas especifico que el tiempo de envio) ---
  {
    palabrasClave: [
      "cuanto cuesta el envio",
      "cuanto cuestan los envios",
      "precio del envio",
      "precio de los envios",
      "coste del envio",
      "gastos de envio",
      "tarifa de envio",
      "cuanto cuesta enviar",
      "envio a peninsula",
      "envios a peninsula",
      "enviar a peninsula",
      "envio a baleares",
      "envios a baleares",
      "enviar a baleares",
      "envio a canarias",
      "envios a canarias",
      "enviar a canarias",
      "zona de envio",
      "zonas de envio",
      "recogida en elche",
      "recoger en elche",
      "recogida gratis",
    ],
    respuesta: {
      texto:
        "Te cuento: a Península son 7,50 €, a Baleares 10 € y a Canarias 14 €. Y si te viene mejor, también puedes recogerlo tú misma/o en Elche sin coste 😊",
    },
  },

  // --- Devoluciones y cambios ---
  {
    palabrasClave: ["devolucion", "devoluciones", "puedo devolver", "cambios", "cambiar el pedido", "reembolso", "garantia", "no me gusta puedo"],
    respuesta: {
      texto:
        "Como cada pieza se hace especialmente para ti, no podemos aceptar devoluciones salvo que tenga algún defecto de fabricación. Lo tienes explicado con más detalle aquí:",
      enlaces: [{ href: "/legal/terminos", label: "Ver términos y condiciones" }],
    },
  },

  // --- Materiales / durabilidad ---
  {
    palabrasClave: [
      "de que esta hecho",
      "de que material",
      "que material",
      "es resistente",
      "se puede mojar",
      "aguanta el agua",
      "aguanta el sol",
      "se rompe",
      "es fragil",
      "resina",
    ],
    respuesta: {
      texto:
        "Está hecho en resina epoxi, así que aguanta bien el día a día. Eso sí, mejor evitar golpes fuertes y que le dé el sol o el agua durante mucho rato seguido.",
    },
  },

  // --- Tiempo de personalización (mas especifico que "puedo personalizar") ---
  {
    palabrasClave: [
      "cuanto tarda en personalizar",
      "cuanto tardan en personalizar",
      "tiempo de personalizacion",
      "plazo de personalizacion",
      "cuanto tarda la personalizacion",
      "tiempo de fabricacion",
      "cuanto tardan en hacer",
      "cuanto tarda en hacerse",
    ],
    respuesta: {
      texto:
        "Eso depende un poco de la pieza y de cuántas unidades necesites. Cuéntanos tu caso y te decimos un plazo concreto sin compromiso.",
    },
  },

  // --- Plazos de entrega en general (no solo "envío") ---
  {
    palabrasClave: [
      "cuanto tarda",
      "cuanto tardais",
      "cuanto se tarda",
      "tiempo de envio",
      "tiempo de entrega",
      "cuando llega",
      "cuando me llega",
      "cuando lo recibo",
      "plazo de envio",
      "plazo de entrega",
      "dias de envio",
      "cuando lo tendria",
    ],
    respuesta: {
      texto:
        "Normalmente tardamos entre 5 y 7 días en enviarlo desde que la pieza está lista — cada una se hace a mano y bajo pedido, así que no las tenemos hechas de antemano 🙂",
    },
  },

  // --- Ocasiones/eventos con nombre propio: puede ser una pieza suelta o un encargo grande ---
  {
    palabrasClave: [
      "graduacion",
      "graduaciones",
      "comunion",
      "boda",
      "bodas",
      "bautizo",
      "despedida de soltera",
      "despedida de soltero",
      "cumpleanos",
      "cumple",
      "san valentin",
      "dia de la madre",
      "dia del padre",
      "regalo de empresa",
      "regalos de empresa",
      "detalle de empresa",
      "baby shower",
      "ocasion especial",
    ],
    respuesta: {
      texto:
        "¡Por supuesto! Hacemos piezas para todo tipo de ocasiones especiales 🎉 Si es solo para ti o para regalar una unidad, mira el catálogo. Y si necesitas varias piezas (15 o más) para el evento, mejor pide presupuesto y lo vemos con calma.",
      enlaces: [
        { href: "/productos", label: "Ver catálogo" },
        { href: "/eventos", label: "Pedir presupuesto para varias unidades" },
      ],
    },
  },

  // --- Encargos por volumen sin nombrar una ocasion concreta ---
  {
    palabrasClave: ["encargo grande", "por volumen", "muchas unidades", "cantidad grande", "detalle para invitados", "pedido grande", "varias unidades"],
    respuesta: {
      texto: "Para pedidos grandes lo mejor es que nos cuentes los detalles y te preparamos un presupuesto a medida.",
      enlaces: [{ href: "/eventos", label: "Solicitar presupuesto" }],
    },
  },

  // --- Personalización en general (opciones, fotos, texto propio) ---
  {
    palabrasClave: [
      "personalizar",
      "personalizacion",
      "puedo poner el nombre",
      "nombre que quiera",
      "mandar una foto",
      "enviar una foto",
      "subir una foto",
      "poner mi foto",
      "poner una foto",
      "texto personalizado",
      "grabar el nombre",
    ],
    respuesta: {
      texto: "¡Claro que sí! Cada producto tiene sus propias opciones — texto, color, foto... Entra en su ficha y verás justo qué puedes personalizar.",
      enlaces: [{ href: "/productos", label: "Ver productos" }],
    },
  },

  // --- Precio en general ---
  {
    palabrasClave: ["cuanto cuesta", "cuanto vale", "precio", "precios", "que precios manejais", "tarifas"],
    respuesta: {
      texto: "Depende de la pieza que elijas, pero los precios empiezan desde 3,50 €. Échale un vistazo al catálogo para verlos todos.",
      enlaces: [{ href: "/productos", label: "Ver catálogo" }],
    },
  },

  // --- Cómo hacer un pedido normal ---
  {
    palabrasClave: ["como pido", "como compro", "como hago un pedido", "quiero comprar", "hacer un pedido", "catalogo", "ver productos", "donde compro"],
    respuesta: {
      texto: "Es superfácil: entras al catálogo, eliges tu producto y lo personalizas a tu gusto antes de comprarlo.",
      enlaces: [{ href: "/productos", label: "Ver productos" }],
    },
  },

  // --- Formas de pago ---
  {
    palabrasClave: ["pago", "pagar", "tarjeta", "stripe", "metodo de pago", "metodos de pago", "como se paga", "formas de pago"],
    respuesta: {
      texto: "Pagas con tarjeta de forma segura a través de Stripe, justo al terminar tu pedido — así de sencillo.",
    },
  },

  // --- Agradecimiento / despedida ---
  {
    palabrasClave: ["gracias", "vale gracias", "muchas gracias", "perfecto gracias", "adios", "hasta luego", "nos vemos", "chao", "de acuerdo", "vale"],
    respuesta: {
      texto: "¡Un placer! Si te surge cualquier otra cosa, aquí me tienes 💕",
      esDespedida: true,
    },
  },
];

const RESPUESTA_SALUDO: ChatRespuesta = {
  texto: "¡Hola! Soy Daniela, la asistente virtual de Hamy 💕 ¿En qué puedo ayudarte?",
};

const RESPUESTA_SIN_COINCIDENCIA: ChatRespuesta = {
  texto:
    "Uy, esa se me escapa un poco 🙈 Puedo ayudarte con envíos, precios, personalización o cómo hacer tu pedido. Y si prefieres, hablamos directamente por aquí y te lo resolvemos:",
  enlaces: [{ href: "/contacto", label: "Ir a contacto" }],
};

export function saludoInicial(): ChatRespuesta {
  return RESPUESTA_SALUDO;
}

export function responderMensaje(mensaje: string): { respuesta: ChatRespuesta; reconocido: boolean } {
  const normalizado = normalizar(mensaje);
  for (const regla of REGLAS) {
    if (regla.palabrasClave.some((palabra) => contienePalabraClave(normalizado, palabra))) {
      return { respuesta: regla.respuesta, reconocido: true };
    }
  }
  return { respuesta: RESPUESTA_SIN_COINCIDENCIA, reconocido: false };
}
