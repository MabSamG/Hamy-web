// Agente virtual del widget de chat ("Daniela"): respuestas predefinidas
// por coincidencia de palabras clave sobre texto libre. Deliberadamente NO
// llama a ningun LLM (evita costes de API recurrentes) — mismo enfoque
// que el agente del sitio de 3G.
//
// Para añadir una intencion nueva: añade una entrada mas a REGLAS con sus
// palabrasClave (variaciones normalizadas, sin acentos) y su respuesta. El
// orden importa — la primera regla cuyas palabras clave coincidan gana, asi
// que las mas especificas deben ir antes que las genericas.
//
// El saludo ("hola", "buenas"...) es un caso aparte (ver esSoloSaludo): solo
// se responde como saludo puro si ESE es todo el mensaje, para que un "hola,
// ¿hacéis llaveros?" conteste a la pregunta real y no se quede en el saludo.

export type ChatEnlace = { href: string; label: string };

export type ChatRespuesta = {
  texto: string;
  enlaces?: ChatEnlace[];
  /** true cuando el propio texto ya invita a dejar nombre/contacto (despedida, hablar con una persona...): el widget abre el mini-formulario justo después, sin repetir esa invitación. */
  invitaDejarContacto?: boolean;
};

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
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
  // --- Envio fuera de España, frases genericas sin nombrar pais/ciudad
  // concretos: va antes que la regla general de envio para que "internacional"
  // no caiga en la respuesta de Peninsula/Baleares/Canarias. Los casos con
  // pais/ciudad concretos ("enviais a Francia") se resuelven aparte, ver
  // esPreguntaEnvioExtranjero mas abajo, para no tener que enumerar cada pais ---
  {
    palabrasClave: [
      "envio internacional",
      "envios internacionales",
      "enviar fuera de espana",
      "envio fuera de espana",
      "enviais fuera de espana",
      "enviar al extranjero",
      "envio al extranjero",
      "enviais al extranjero",
      "enviais a otros paises",
      "enviais a otro pais",
      "enviar a otro pais",
      "envio a otro pais",
      "fuera de espana",
      "otro pais",
      "otros paises",
    ],
    respuesta: {
      texto: "De momento solo hacemos envíos dentro de España (Península, Baleares y Canarias) — fuera de España no está disponible todavía, lo sentimos 😔",
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
        "Te cuento: a Península son 6 €, a Baleares 10 € y a Canarias 14 €. Y si te viene mejor, también puedes recogerlo tú misma/o en Elche sin coste 😊",
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

  // --- Plazos de entrega en general (no solo "envío") — va antes que "Estado
  // de un pedido ya hecho" para que una pregunta pre-compra tipo "cuánto
  // tardaré en tener mi encargo" reciba el plazo medio, no el enlace de
  // seguimiento (esa persona aún no ha pedido nada) ---
  {
    palabrasClave: [
      "cuanto tarda",
      "cuanto tardais",
      "cuanto tardare",
      "cuanto tardaria",
      "cuanto se tarda",
      "tiempo de envio",
      "tiempo de entrega",
      "cuando llega",
      "cuando me llega",
      "cuando lo recibo",
      "cuando lo tendre",
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

  // --- Estado de un pedido YA hecho: solo frases explicitas de seguimiento,
  // sin palabras sueltas como "mi pedido"/"mi encargo" (esas solas coinciden
  // tambien con preguntas pre-compra sobre plazos, ver regla anterior) ---
  {
    palabrasClave: [
      "estado de mi pedido",
      "estado de mi encargo",
      "estado de mi compra",
      "donde esta mi pedido",
      "donde esta mi encargo",
      "donde esta mi compra",
      "seguimiento",
      "rastrear",
      "en que va mi pedido",
      "en que va mi encargo",
    ],
    respuesta: {
      texto: "Con tu número de referencia y el email que usaste al pedir puedes ver en qué punto va tu pedido aquí:",
      enlaces: [{ href: "/mi-pedido", label: "Consultar mi pedido" }],
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
        "¡Por supuesto! Hacemos piezas para todo tipo de celebraciones 🎉 Si es una pieza suelta o para regalar, mira características y precio en la ficha del producto. Y si necesitas varias para el evento (el pedido mínimo es de 15 unidades), rellena el formulario de encargos y te preparamos un presupuesto.",
      enlaces: [
        { href: "/productos", label: "Ver catálogo" },
        { href: "/eventos", label: "Formulario de encargos" },
      ],
    },
  },

  // --- Encargos por volumen sin nombrar una ocasion concreta ---
  {
    palabrasClave: ["encargo grande", "por volumen", "muchas unidades", "cantidad grande", "detalle para invitados", "pedido grande", "varias unidades", "pedido minimo"],
    respuesta: {
      texto: "Para pedidos grandes el mínimo son 15 unidades. Cuéntanos los detalles en el formulario de encargos y te preparamos un presupuesto a medida.",
      enlaces: [{ href: "/eventos", label: "Formulario de encargos" }],
    },
  },

  // --- Productos que NO trabajamos (joyeria, relojes, cuadros, lamparas...):
  // va antes que las reglas genericas de precio/catalogo para que, p. ej.,
  // "cuanto cuesta un collar" no responda como si lo vendiéramos ---
  {
    palabrasClave: [
      "colgante",
      "colgantes",
      "collar",
      "collares",
      "pulsera",
      "pulseras",
      "anillo",
      "anillos",
      "pendiente",
      "pendientes",
      "reloj",
      "relojes",
      "cuadro",
      "cuadros",
      "lampara",
      "lamparas",
    ],
    respuesta: {
      texto: "De momento ese producto no lo trabajamos, lo siento.",
    },
  },

  // --- Elementos de decoracion concretos (flores, purpurina...): remite a la
  // ficha del producto y explica que se piden/excluyen como nota al pedir ---
  {
    palabrasClave: ["flores", "flor", "purpurina", "brillantina", "glitter", "gliter", "petalos", "caracolas", "más fotos", "+ fotos", "mas fotos", "arena", "elementos decorativos", "elementos", "pelo", "cabello", "tripa", "cordón", "cordon", "cordón umbilical", "cordón humbilical", "cordon umbilical", "cordon humbilical","brillos", "confeti", "pan de oro"],
    respuesta: {
      texto:
        "Cada pieza tiene sus propias opciones de decoración — entra en su ficha para ver justo qué incluye. Y si quieres pedir (o evitar) algo en concreto, como flores o purpurina, puedes indicarlo en las notas al hacer tu pedido: te confirmamos cuanto antes si es posible.",
      enlaces: [{ href: "/productos", label: "Ver características" }],
    },
  },

  // --- Personalización en general (opciones, fotos, recuerdos, detalles) ---
  {
    palabrasClave: [
      "personalizar",
      "personalizacion",
      "personalizada",
      "personalizado",
      "puedo poner el nombre",
      "nombre que quiera",
      "mandar una foto",
      "mandar mi foto",
      "mandar mi propia foto",
      "enviar una foto",
      "enviar mi foto",
      "subir una foto",
      "subir mi foto",
      "poner mi foto",
      "poner una foto",
      "propia foto",
      "con foto",
      "con mi foto",
      "texto personalizado",
      "detalle personalizado",
      "detalles personalizados",
      "recuerdo personalizado",
      "recuerdos personalizados",
      "regalo personalizado",
      "grabar el nombre",
    ],
    respuesta: {
      texto: "¡Claro que sí! Cada producto tiene sus propias opciones — texto, color, foto... Entra en su ficha y verás justo qué puedes personalizar.",
      enlaces: [{ href: "/productos", label: "Ver productos" }],
    },
  },

  // --- Tipos de producto / catálogo (llaveros, marcapáginas, decoración...) ---
  {
    palabrasClave: [
      "llavero",
      "llaveros",
      "laveros",
      "llabero",
      "llaberos",
      "marcapaginas",
      "marcapáginas",
      "marcapágina",
      "marcapagina",
      "marca paginas",
      "marca pagina",
      "punto de libro",
      "puntos de libro",
      "corazon",
      "corazón",
      "corazones",
      "decoracion",
      "decorativo",
      "decorativa",
      "recuerdo",
      "recuerdos",
      "que productos teneis",
      "que vendeis",
      "que teneis",
      "que hacen",
      "que haceis",
    ],
    respuesta: {
      texto: "En cada ficha de producto puedes ver sus características y el precio actualizado — echa un vistazo al catálogo:",
      enlaces: [{ href: "/productos", label: "Ver catálogo" }],
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

  // --- Horario / hablar con una persona: no hay atencion telefonica en vivo,
  // se deriva siempre a dejar nombre+mail para que le contesten ---
  {
    palabrasClave: [
      "horario de atencion",
      "horario de atencion al cliente",
      "vuestro horario",
      "que horario teneis",
      "horario de apertura",
      "hablar con una persona",
      "hablar con alguien",
      "hablar con vosotras",
      "hablar con vosotros",
      "con quien puedo hablar",
      "con quien hablo",
      "con quien contacto",
      "atencion al cliente",
      "atencion telefonica",
      "numero de telefono",
      "telefono de contacto",
      "os puedo llamar",
      "puedo llamaros",
    ],
    respuesta: {
      texto: "Para hablar con nosotras, déjanos tu nombre y mail y nos pondremos en contacto contigo lo antes posible 😊",
      invitaDejarContacto: true,
    },
  },

  // --- Agradecimiento / despedida ---
  {
    palabrasClave: [
      "gracias",
      "vale gracias",
      "muchas gracias",
      "perfecto gracias",
      "adios",
      "hasta luego",
      "hasta pronto",
      "nos vemos",
      "un saludo",
      "chao",
      "de acuerdo",
      "vale",
      "ok",
      "oki",
    ],
    respuesta: {
      texto:
        "¡Un placer! Para cualquier cosa que necesites, escríbenos por WhatsApp, usa el formulario de contacto, o déjame aquí tu nombre y contacto y te escribimos nosotros 😊",
      enlaces: [
        { href: "https://wa.me/34600000000", label: "Escríbenos por WhatsApp" },
        { href: "/contacto", label: "Ir a contacto" },
      ],
      invitaDejarContacto: true,
    },
  },
];

// Saludo: caso aparte porque debe cubrir SOLO el saludo, no cualquier mensaje
// que empiece por "hola" (p. ej. "hola quiero saber si tenéis llaveros" debe
// responder a la pregunta, no quedarse en el saludo). Se comprueba palabra a
// palabra para cubrir cualquier combinación ("holaaa que tal", "buenas,
// Daniela"...) sin tener que enumerar cada frase completa.
const PALABRAS_SALUDO = new Set([
  "hola",
  "holaa",
  "holaaa",
  "holaaaa",
  "holis",
  "hey",
  "ey",
  "buenas",
  "buenos",
  "dias",
  "tardes",
  "noches",
  "que",
  "tal",
  "saludos",
  "daniela",
]);

function esSoloSaludo(normalizado: string): boolean {
  const limpio = normalizado.replace(/[¡!¿?.,]/g, "").trim();
  if (!limpio) return false;
  const palabras = limpio.split(" ");
  return palabras.every((palabra) => PALABRAS_SALUDO.has(palabra));
}

const RESPUESTA_SALUDO: ChatRespuesta = {
  texto: "¡Hola! Soy Daniela, la asistente virtual de Hamy 💕 ¿En qué puedo ayudarte?",
};

const RESPUESTA_SALUDO_RESPUESTA: ChatRespuesta = {
  texto: "¡Hola! ¿En qué puedo ayudarte? 😊",
};

const RESPUESTA_SIN_COINCIDENCIA: ChatRespuesta = {
  texto:
    "Uy, esa se me escapa un poco 🙈 Puedo ayudarte con envíos, precios, personalización o cómo hacer tu pedido. Y si prefieres, hablamos directamente por aquí y te lo resolvemos:",
  enlaces: [{ href: "/contacto", label: "Ir a contacto" }],
};

// Solo pedimos el nombre/contacto del visitante cuando hay una intención real
// de reservar, comprar o encargar — no por el simple hecho de preguntar o
// informarse (envíos, precios, materiales...), que no justifica pedir datos.
const PALABRAS_INTENCION_COMPRA = [
  "reservar",
  "como reservo",
  "comprar",
  "comprarlo",
  "encargar",
  "encargarlo",
  "como encargo",
  "hacer un encargo",
  "hacer un pedido",
  "quiero pedir",
  "quiero pedirlo",
  "quiero encargar",
  "quiero encargarlo",
  "quiero comprar",
  "quiero comprarlo",
  "quiero reservar",
  "confirmar mi pedido",
  "confirmar el pedido",
];

function tieneIntencionDeCompra(normalizado: string): boolean {
  return PALABRAS_INTENCION_COMPRA.some((palabra) => contienePalabraClave(normalizado, palabra));
}

// "¡Sí, tenemos!" solo se afirma cuando preguntan expresamente "¿tenéis
// [algo que sí tenemos]?" — mencionar un producto sin "tenéis" (p. ej. "los
// llaveros son resistentes") cae en la regla general del catálogo, que no
// afirma nada, para no dar por hecho lo que se está preguntando.
const PALABRAS_CATEGORIA_EXISTENTE = [
  "llavero",
  "llaveros",
  "laveros",
  "llabero",
  "llaberos",
  "marcapaginas",
  "marcapagina",
  "marca paginas",
  "marca pagina",
  "punto de libro",
  "puntos de libro",
  "corazon",
  "corazones",
  "decoracion",
  "decorativo",
  "decorativa",
  "recuerdo",
  "recuerdos",
];

function esPreguntaTeneisProducto(normalizado: string): boolean {
  if (!contienePalabraClave(normalizado, "teneis")) return false;
  return PALABRAS_CATEGORIA_EXISTENTE.some((palabra) => contienePalabraClave(normalizado, palabra));
}

const RESPUESTA_SI_TENEMOS: ChatRespuesta = {
  texto: "¡Sí, tenemos! En cada ficha de producto puedes ver sus características y el precio actualizado — echa un vistazo al catálogo:",
  enlaces: [{ href: "/productos", label: "Ver catálogo" }],
};

// "¿Tenéis X?" sin nombrar una categoria generica ("que teneis") ni una que
// sí tenemos (ver arriba) se interpreta como preguntar por un producto que
// NO existe en la tienda (p. ej. "¿tenéis pendientes?") — sin este aviso
// explicito, "tenéis" caia en el bucle de REGLAS y podia colar por accidente
// en una regla no relacionada (p. ej. "vale" dentro de la despedida).
const PALABRAS_PREGUNTA_GENERICA_TENEIS = ["que productos teneis", "que teneis", "que vendeis", "que hacen", "que haceis"];

function esPreguntaGenericaSinProducto(normalizado: string): boolean {
  return PALABRAS_PREGUNTA_GENERICA_TENEIS.some((palabra) => contienePalabraClave(normalizado, palabra));
}

const RESPUESTA_PRODUCTO_NO_DISPONIBLE: ChatRespuesta = {
  texto: "De momento ese producto no lo trabajamos, lo siento.",
};

// Envio a un pais/ciudad concreto de fuera de España (p. ej. "enviais a
// Francia", "haceis envios a Lisboa"): en vez de enumerar cada combinacion
// verbo+pais como palabra clave literal, se detecta por combinacion — un
// verbo de envio junto a un pais/ciudad conocidos fuera de España — para que
// cubra cualquier pais sin tener que anadir uno a uno.
const VERBOS_ENVIO = ["enviais a", "envio a", "envios a", "enviar a", "hacer envios a", "haceis envios a", "hace envios a", "mandais a", "mandar a"];

const PAISES_O_CIUDADES_EXTRANJERO = [
  "francia",
  "portugal",
  "italia",
  "alemania",
  "reino unido",
  "inglaterra",
  "holanda",
  "paises bajos",
  "belgica",
  "suiza",
  "austria",
  "irlanda",
  "estados unidos",
  "eeuu",
  "mexico",
  "argentina",
  "colombia",
  "chile",
  "peru",
  "venezuela",
  "ecuador",
  "uruguay",
  "paraguay",
  "bolivia",
  "marruecos",
  "andorra",
  "europa",
  "polonia",
  "grecia",
  "rumania",
  "paris",
  "lisboa",
  "londres",
  "roma",
  "berlin",
  "milan",
  "amsterdam",
  "bruselas",
];

function esPreguntaEnvioExtranjero(normalizado: string): boolean {
  if (!VERBOS_ENVIO.some((verbo) => contienePalabraClave(normalizado, verbo))) return false;
  return PAISES_O_CIUDADES_EXTRANJERO.some((lugar) => contienePalabraClave(normalizado, lugar));
}

const RESPUESTA_ENVIO_EXTRANJERO: ChatRespuesta = {
  texto: "De momento solo hacemos envíos dentro de España (Península, Baleares y Canarias) — fuera de España no está disponible todavía, lo sentimos 😔",
};

export function saludoInicial(): ChatRespuesta {
  return RESPUESTA_SALUDO;
}

export function responderMensaje(mensaje: string): { respuesta: ChatRespuesta; reconocido: boolean; intencionDeCompra: boolean } {
  const normalizado = normalizar(mensaje);
  const intencionDeCompra = tieneIntencionDeCompra(normalizado);

  if (esSoloSaludo(normalizado)) {
    return { respuesta: RESPUESTA_SALUDO_RESPUESTA, reconocido: true, intencionDeCompra };
  }

  if (esPreguntaTeneisProducto(normalizado)) {
    return { respuesta: RESPUESTA_SI_TENEMOS, reconocido: true, intencionDeCompra };
  }

  if (esPreguntaEnvioExtranjero(normalizado)) {
    return { respuesta: RESPUESTA_ENVIO_EXTRANJERO, reconocido: true, intencionDeCompra };
  }

  if (contienePalabraClave(normalizado, "teneis") && !esPreguntaGenericaSinProducto(normalizado)) {
    return { respuesta: RESPUESTA_PRODUCTO_NO_DISPONIBLE, reconocido: true, intencionDeCompra };
  }

  for (const regla of REGLAS) {
    if (regla.palabrasClave.some((palabra) => contienePalabraClave(normalizado, palabra))) {
      return { respuesta: regla.respuesta, reconocido: true, intencionDeCompra };
    }
  }
  return { respuesta: RESPUESTA_SIN_COINCIDENCIA, reconocido: false, intencionDeCompra };
}
