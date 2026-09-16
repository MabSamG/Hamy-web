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

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
