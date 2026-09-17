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
      texto: "Puedes consultar el estado de tu pedido con tu número de referencia y tu email.",
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
        "Los costes de envío son: Península 7,50 €, Baleares 10 €, Canarias 14 €. También puedes recoger tu pedido gratis en Elche.",
    },
  },

  // --- Devoluciones y cambios ---
  {
    palabrasClave: ["devolucion", "devoluciones", "puedo devolver", "cambios", "cambiar el pedido", "reembolso", "garantia", "no me gusta puedo"],
    respuesta: {
      texto:
        "Al ser piezas personalizadas y hechas a mano, no se aceptan devoluciones salvo defecto de fabricación. Tienes el detalle completo en nuestros Términos y condiciones.",
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
        "Están hechas en resina epoxi: son resistentes para el uso diario, pero te recomendamos evitar golpes fuertes y la exposición prolongada al sol o al agua.",
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
        "El tiempo de personalización depende de la pieza y de la cantidad que pidas. Contáctanos y te damos un plazo exacto para tu caso.",
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
      texto: "Los pedidos salen en 5-7 días desde que la pieza está terminada (cada pieza se hace a mano y bajo pedido).",
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
        "¡Sí! Hacemos piezas personalizadas para cualquier ocasión 🎉 Si buscas una pieza suelta, échale un ojo al catálogo. Si son varias unidades (15+) para un evento, mejor pide presupuesto por el formulario de eventos.",
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
      texto: "Para encargos por volumen, cuéntanos los detalles y te preparamos un presupuesto.",
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
      texto: "Cada producto tiene sus propias opciones de personalización (texto, color, foto...). Puedes verlas en la ficha de cada producto.",
      enlaces: [{ href: "/productos", label: "Ver productos" }],
    },
  },

  // --- Precio en general ---
  {
    palabrasClave: ["cuanto cuesta", "cuanto vale", "precio", "precios", "que precios manejais", "tarifas"],
    respuesta: {
      texto: "Los precios varían según la pieza, desde 3,50 €. Puedes ver el catálogo completo con precios actualizados aquí.",
      enlaces: [{ href: "/productos", label: "Ver catálogo" }],
    },
  },

  // --- Cómo hacer un pedido normal ---
  {
    palabrasClave: ["como pido", "como compro", "como hago un pedido", "quiero comprar", "hacer un pedido", "catalogo", "ver productos", "donde compro"],
    respuesta: {
      texto: "Puedes hacer tu pedido directamente desde nuestro catálogo, eligiendo el producto y personalizándolo a tu gusto.",
      enlaces: [{ href: "/productos", label: "Ver productos" }],
    },
  },

  // --- Formas de pago ---
  {
    palabrasClave: ["pago", "pagar", "tarjeta", "stripe", "metodo de pago", "metodos de pago", "como se paga", "formas de pago"],
    respuesta: {
      texto: "Aceptamos pago con tarjeta de forma segura a través de Stripe, directamente al finalizar tu pedido.",
    },
  },

  // --- Agradecimiento / despedida ---
  {
    palabrasClave: ["gracias", "vale gracias", "muchas gracias", "perfecto gracias", "adios", "hasta luego", "nos vemos", "chao", "de acuerdo", "vale"],
    respuesta: {
      texto: "¡De nada! Si necesitas cualquier otra cosa, aquí estoy 💕",
      esDespedida: true,
    },
  },
];

const RESPUESTA_SALUDO: ChatRespuesta = {
  texto: "¡Hola! Soy Daniela, la asistente virtual de Hamy 💕 ¿En qué puedo ayudarte?",
};

const RESPUESTA_SIN_COINCIDENCIA: ChatRespuesta = {
  texto: "No he sabido responder a eso con la información que tengo. Escríbenos por WhatsApp o por el formulario de contacto y te ayudamos encantados.",
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
