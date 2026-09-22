# Astro Starter Kit: Minimal

```sh
npm create astro@latest -- --template minimal
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
├── src/
│   └── pages/
│       └── index.astro
└── package.json
```

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

There's nothing special about `src/components/`, but that's where we like to put any Astro/React/Vue/Svelte/Preact components.

Any static assets, like images, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## 🗄️ Supabase

El catálogo (`productos`) y los pedidos (`pedidos`) viven en Supabase. Para levantar el proyecto en local:

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En el SQL Editor del proyecto, pega y ejecuta `supabase/schema.sql` (tablas, RLS, bucket de fotos `fotos-pedidos` y el seed con el catálogo actual).
3. Copia `.env.example` a `.env` y rellena `PUBLIC_SUPABASE_URL` y `PUBLIC_SUPABASE_ANON_KEY` con los valores de Project Settings > API.

## 📧 Notificaciones por email (Resend)

Cuando llega un pedido nuevo (carrito), una consulta de evento (`/eventos`) o un mensaje de contacto
(`/contacto`), el sitio intenta avisar por email a través de [Resend](https://resend.com). Esto pasa por
`src/pages/api/notify.ts`, la única ruta del sitio que no es estática (necesita ejecutarse en un servidor
para no exponer la API key de Resend al navegador).

Para activarlo:

1. Crea una cuenta gratuita en [resend.com](https://resend.com).
2. Ve a **API Keys > Create API Key** y copia el valor generado.
3. Pégalo en tu `.env` como `RESEND_API_KEY`.
4. Revisa que `NOTIFICATION_EMAIL` en tu `.env` sea la dirección donde quieres recibir los avisos.

Mientras no exista dominio propio verificado en Resend, los emails se envían desde
`onboarding@resend.dev` — es el dominio de pruebas que Resend ofrece por defecto, funciona sin
configuración adicional pero solo sirve para desarrollo/pruebas (tiene límites de envío y puede caer en
spam). Cuando tengas un dominio propio, verifícalo en Resend y cambia el remitente en
`src/pages/api/notify.ts` (`from: "Hamy <onboarding@resend.dev>"`) por una dirección de ese dominio.

Si `RESEND_API_KEY` está vacía o no configurada, el sitio sigue funcionando con total normalidad: el
pedido/consulta/mensaje se guarda igual en Supabase, simplemente no se envía el email de aviso.

## 💳 Pago online (Stripe)

El carrito (`/carrito`) guarda el pedido en Supabase (`estado: "recibido"`, `pago_estado: "pendiente"`) y a
continuación redirige al cliente a Stripe Checkout para pagar. `src/pages/api/crear-pago.ts` crea la sesión de
pago (recalculando precios y envío desde el catálogo real, no de lo que mande el navegador) y
`src/pages/api/stripe-webhook.ts` recibe la confirmación de Stripe y marca el pedido como `pago_estado: "pagado"`
— solo entonces se envía el email de aviso al admin y se limpia el carrito del cliente en `/pedido-confirmado`. Si
el cliente cancela el pago, el pedido queda guardado como pendiente y el carrito sigue intacto para reintentarlo.

Para activarlo en local:

1. Crea una cuenta en [stripe.com](https://stripe.com) (el modo de pruebas ya viene activo, no hace falta
   verificar el negocio todavía).
2. Ve a **Developers > API keys** y copia la **Secret key** (empieza por `sk_test_...`) a `STRIPE_SECRET_KEY`
   en tu `.env`.
3. Ve a **Project Settings > API > service_role** en Supabase y copia esa key (distinta de la anon key) a
   `SUPABASE_SERVICE_ROLE_KEY`. Solo la usan las rutas de servidor (`crear-pago.ts`, `stripe-webhook.ts`), nunca
   llega al navegador.
4. Instala el [Stripe CLI](https://docs.stripe.com/stripe-cli) y ejecuta, con el sitio corriendo en local:
   ```
   stripe listen --forward-to localhost:4321/api/stripe-webhook
   ```
   Copia el `whsec_...` que te muestra a `STRIPE_WEBHOOK_SECRET` en tu `.env` (reinicia `astro dev` después).
5. Prueba el flujo completo con una [tarjeta de pruebas](https://docs.stripe.com/testing) de Stripe, por ejemplo
   `4242 4242 4242 4242`, cualquier fecha futura y cualquier CVC.

**Para producción (modo real):** despliega primero el sitio (Netlify), luego en el dashboard de Stripe cambia a
modo real (Live), repite el paso 2 con la clave `sk_live_...`, y en **Developers > Webhooks** crea un endpoint
apuntando a `https://tu-dominio/api/stripe-webhook` (evento `checkout.session.completed`) para obtener el
`STRIPE_WEBHOOK_SECRET` real — configura ambas variables (y `SUPABASE_SERVICE_ROLE_KEY`) como variables de
entorno del sitio en Netlify, nunca las subas al repositorio.

Un admin puede además marcar un pedido como pagado a mano desde `/admin` (pestaña Pedidos) — útil para pagos en
efectivo al recoger en Elche o coordinados por otra vía fuera de Stripe.

## 📊 Informe semanal de ventas automático

Además del resumen manual bajo demanda en `/admin` (pestaña **Ventas**, con atajos de fecha y descarga
CSV), existe una **Netlify Scheduled Function** (`netlify/functions/informe-semanal.ts`) que cada lunes
a las 6:00 UTC calcula el mismo resumen pero de la semana anterior (total facturado, número de pedidos,
clientes nuevos y productos más vendidos) y lo envía por email a `somos.hamy@gmail.com` vía Resend, con
el detalle adjunto en CSV. La lógica de cálculo vive en `src/lib/ventas.ts`, compartida entre la pestaña
del admin y esta función, para no mantenerla dos veces.

**Importante:** las funciones programadas de Netlify **solo se ejecutan una vez el sitio está
desplegado** — no se disparan con `npm run dev` ni con ningún comando en local, no hay forma de probarlas
sin desplegar. La buena noticia (confirmado contra la documentación oficial de Netlify): **no hace falta
activar nada a mano en el dashboard** — Netlify detecta el `export const config = { schedule: ... }` del
propio código nada más desplegar, sin paso manual adicional, y las scheduled functions están disponibles
en todos los planes (incluido el gratuito). Aun así, conviene comprobar esto tras el primer despliegue:

1. Despliega el sitio a Netlify (o haz push si ya está conectado — el `netlify.toml` de la raíz declara
   `netlify/functions` como carpeta de funciones, así Netlify la detecta sin configuración manual
   adicional).
2. En el dashboard de Netlify, ve a **Functions** del sitio y confirma que aparece `informe-semanal` con
   un badge de **Scheduled** (el cron `0 6 * * 1` se lee directamente del código).
3. Comprueba que las variables de entorno `RESEND_API_KEY`, `PUBLIC_SUPABASE_URL` y
   `SUPABASE_SERVICE_ROLE_KEY` están puestas para el sitio en Netlify (deberían estarlo ya, son las mismas
   que usan `/api/notify` y `/api/crear-pago` — llegan igual a las funciones programadas, aunque estén
   marcadas como "Secret").
4. Para comprobar que funciona sin esperar al lunes, entra en esa función desde el dashboard y pulsa
   **"Run now"** — hazlo una vez tras el primer despliegue para confirmar que llega el email.

Límite a tener en cuenta: las scheduled functions de Netlify tienen un **tope de 30 segundos** de
ejecución. Para el volumen de pedidos de Hamy no debería ser problema (una consulta a Supabase y una
llamada a Resend), pero si el histórico de pedidos crece mucho con los años, vigílalo.

Si `RESEND_API_KEY` no está configurada, la función no falla: registra un aviso en los logs de Netlify y
no envía nada, igual que `/api/notify`.

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
