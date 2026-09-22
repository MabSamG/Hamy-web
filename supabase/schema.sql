-- ============================================================
-- Hamy — esquema de Supabase (productos, pedidos, storage, RLS)
--
-- Como aplicarlo:
-- 1. Crea un proyecto en https://supabase.com (plan gratuito vale).
-- 2. Ve a SQL Editor > New query, pega este archivo completo y
--    ejecutalo (Run). Es seguro volver a ejecutarlo si algo falla
--    a medias: las tablas usan "if not exists" y las politicas se
--    recrean con "drop policy if exists".
-- 3. Copia Project Settings > API > Project URL y anon public key
--    a tu archivo .env (ver .env.example en la raiz del proyecto).
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- ROL DE SOLO LECTURA (demo) — un usuario de Supabase Auth con
-- app_metadata.rol = 'demo' (solo se puede marcar con la service_role key,
-- el usuario no puede cambiarselo el mismo) puede LEER todo el panel /admin
-- igual que el admin real, pero cualquier escritura queda bloqueada aqui en
-- RLS, no solo ocultando botones en la UI — asi el catalogo/pedidos reales
-- quedan a salvo aunque alguien intente escribir directamente con supabase-js
-- desde la consola del navegador. Un admin normal no tiene ese campo, y
-- coalesce(...) lo trata como "no es demo", asi que no le afecta.
-- ------------------------------------------------------------

create or replace function public.es_admin_editor()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'rol', 'admin') <> 'demo';
$$;

-- ------------------------------------------------------------
-- 1. CATEGORIAS — categorias del catalogo, editables desde /admin
--    (crear una nueva categoria al añadir un producto la guarda aqui,
--    y la web publica las lee de esta tabla, sin tocar codigo)
-- ------------------------------------------------------------

create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nombre text not null,
  descripcion text not null default '',
  emoji text not null default '✨',
  creado_en timestamptz not null default now()
);

alter table public.categorias enable row level security;

drop policy if exists "categorias: lectura publica" on public.categorias;
create policy "categorias: lectura publica"
  on public.categorias for select
  to anon, authenticated
  using (true);

drop policy if exists "categorias: escritura solo admin" on public.categorias;
create policy "categorias: escritura solo admin"
  on public.categorias for all
  to authenticated
  using (public.es_admin_editor())
  with check (public.es_admin_editor());

insert into public.categorias (slug, nombre, descripcion, emoji) values
  ('llaveros', 'Llaveros', 'Pequeños detalles para llevar siempre contigo.', '🔑'),
  ('puntos-de-libro', 'Puntos de libro', 'Marcapáginas únicos para los amantes de la lectura.', '📖'),
  ('decoracion', 'Decoración', 'Piezas artesanales para dar vida a tus espacios.', '🏡'),
  ('recuerdos-personalizados', 'Recuerdos personalizados', 'Momentos únicos convertidos en piezas para siempre.', '💞')
on conflict (slug) do update set
  nombre = excluded.nombre,
  descripcion = excluded.descripcion,
  emoji = excluded.emoji;

-- ------------------------------------------------------------
-- 2. PRODUCTOS — catalogo publico
-- ------------------------------------------------------------

create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nombre text not null,
  categoria text not null,
  categorias text[] not null default '{}',
  precio_base integer not null, -- precio en centimos de euro (1200 = 12,00 EUR)
  descripcion_corta text not null,
  descripcion text not null,
  emoji text,
  imagen_principal text,
  stock integer, -- null = pieza hecha bajo pedido, sin stock fijo
  destacado boolean not null default false,
  -- Grupos/campos del formulario de personalizacion de este producto (misma
  -- forma que src/data/personalization.ts: PersonalizationGroup[]). Vive en
  -- la fila del producto, no en codigo, para que el panel /admin pueda crear
  -- productos nuevos eligiendo una plantilla sin necesitar un despliegue.
  personalizacion jsonb not null default '[]'::jsonb,
  -- Peso de la pieza en gramos, para calcular el envio por tramos de peso
  -- (ver seccion 3, pedidos). No incluye el embalaje (eso se suma aparte,
  -- ver PESO_EMBALAJE_GRAMOS en src/data/shipping.ts).
  peso_gramos integer not null default 0,
  creado_en timestamptz not null default now()
);

-- Para proyectos donde la tabla ya existia antes de esta columna.
alter table public.productos add column if not exists personalizacion jsonb not null default '[]'::jsonb;
alter table public.productos add column if not exists peso_gramos integer not null default 0;

alter table public.productos enable row level security;

drop policy if exists "productos: lectura publica" on public.productos;
create policy "productos: lectura publica"
  on public.productos for select
  to anon, authenticated
  using (true);

-- Solo un admin autenticado (Supabase Auth) puede crear/editar/borrar productos.
-- (es_admin_editor() excluye a la cuenta demo de solo lectura, ver arriba)
drop policy if exists "productos: escritura solo admin" on public.productos;
create policy "productos: escritura solo admin"
  on public.productos for all
  to authenticated
  using (public.es_admin_editor())
  with check (public.es_admin_editor());

-- ------------------------------------------------------------
-- 3. PEDIDOS — cada pedido con su personalizacion en JSON
-- ------------------------------------------------------------

create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  creado_en timestamptz not null default now(),
  estado text not null default 'recibido' check (estado in ('recibido', 'preparando', 'enviado')),
  cliente_nombre text not null,
  cliente_email text not null,
  cliente_telefono text,
  cliente_direccion text,
  -- Un pedido puede tener varios productos; cada item guarda su propia
  -- personalizacion con la forma que corresponda a ese producto (foto+datos
  -- del bebe, texto del marcapaginas, letra del llavero, o cara-1/cara-2
  -- del corazon). Las fotos se guardan como la ruta del objeto en el
  -- bucket de Storage, no el archivo en si.
  -- Forma esperada de cada elemento de items:
  -- {
  --   "producto_slug": "corazon-personalizado",
  --   "producto_nombre": "Corazón personalizado",
  --   "cantidad": 1,
  --   "precio_unitario_cents": 2000,
  --   "personalizacion": {
  --     "cara-1": { "texto": "...", "foto": "fotos-pedidos/pedidoTmp123/cara-1.jpg" },
  --     "cara-2": { "texto": "...", "foto": null }
  --   }
  -- }
  items jsonb not null,
  -- subtotal_cents = solo productos; envio_cents = coste de envio calculado
  -- segun peso_total_gramos y la zona elegida (tramos de Paq Ligero de
  -- Correos, ver src/data/shipping.ts); total_cents = subtotal_cents +
  -- envio_cents (lo que se muestra como total final al cliente y en el
  -- admin). peso_total_gramos = suma del peso de cada producto + el
  -- embalaje fijo, calculado en el carrito en el momento del pedido.
  subtotal_cents integer not null default 0,
  zona_envio text not null default 'peninsula' check (zona_envio in ('peninsula', 'baleares', 'canarias', 'recogida')),
  peso_total_gramos integer not null default 0,
  envio_cents integer not null default 0,
  total_cents integer not null,
  notas text,
  -- pago_estado refleja el pago con Stripe (independiente de "estado", que es
  -- el flujo de preparacion/envio). Lo actualiza el webhook de Stripe al
  -- confirmarse el pago, o el admin a mano para pagos en efectivo/recogida.
  pago_estado text not null default 'pendiente' check (pago_estado in ('pendiente', 'pagado')),
  stripe_payment_intent_id text,
  stripe_session_id text
);

-- Para proyectos donde la tabla ya existia antes de estas columnas: los
-- pedidos previos no tenian gastos de envio, asi que su subtotal es el
-- total que ya tenian guardado.
alter table public.pedidos add column if not exists subtotal_cents integer;
update public.pedidos set subtotal_cents = total_cents where subtotal_cents is null;
alter table public.pedidos alter column subtotal_cents set not null;
alter table public.pedidos alter column subtotal_cents set default 0;

alter table public.pedidos add column if not exists zona_envio text;
update public.pedidos set zona_envio = 'peninsula' where zona_envio is null;
alter table public.pedidos alter column zona_envio set not null;
alter table public.pedidos alter column zona_envio set default 'peninsula';
alter table public.pedidos drop constraint if exists pedidos_zona_envio_check;
alter table public.pedidos add constraint pedidos_zona_envio_check check (zona_envio in ('peninsula', 'baleares', 'canarias', 'recogida'));

alter table public.pedidos add column if not exists envio_cents integer;
update public.pedidos set envio_cents = 0 where envio_cents is null;
alter table public.pedidos alter column envio_cents set not null;
alter table public.pedidos alter column envio_cents set default 0;

alter table public.pedidos add column if not exists peso_total_gramos integer;
update public.pedidos set peso_total_gramos = 0 where peso_total_gramos is null;
alter table public.pedidos alter column peso_total_gramos set not null;
alter table public.pedidos alter column peso_total_gramos set default 0;

-- Para proyectos donde la tabla ya existia antes de esta columna (pedidos
-- previos al pago con Stripe): se asumen pendientes de pago hasta que un
-- admin los marque a mano, ya que no hay forma de saber su estado real.
alter table public.pedidos add column if not exists pago_estado text;
update public.pedidos set pago_estado = 'pendiente' where pago_estado is null;
alter table public.pedidos alter column pago_estado set not null;
alter table public.pedidos alter column pago_estado set default 'pendiente';
alter table public.pedidos drop constraint if exists pedidos_pago_estado_check;
alter table public.pedidos add constraint pedidos_pago_estado_check check (pago_estado in ('pendiente', 'pagado'));

alter table public.pedidos add column if not exists stripe_session_id text;

alter table public.pedidos enable row level security;

-- El formulario publico puede crear pedidos, pero siempre en estado inicial.
drop policy if exists "pedidos: creacion publica" on public.pedidos;
create policy "pedidos: creacion publica"
  on public.pedidos for insert
  to anon, authenticated
  with check (estado = 'recibido');

-- Solo el admin autenticado puede ver y gestionar (incluye cambiar estado).
drop policy if exists "pedidos: lectura solo admin" on public.pedidos;
create policy "pedidos: lectura solo admin"
  on public.pedidos for select
  to authenticated
  using (true);

drop policy if exists "pedidos: actualizacion solo admin" on public.pedidos;
create policy "pedidos: actualizacion solo admin"
  on public.pedidos for update
  to authenticated
  using (public.es_admin_editor())
  with check (public.es_admin_editor());

-- ------------------------------------------------------------
-- 4. STORAGE — fotos que suben los clientes al personalizar
-- ------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('fotos-pedidos', 'fotos-pedidos', false)
on conflict (id) do nothing;

-- Cualquiera (cliente sin login) puede subir una foto durante el pedido.
drop policy if exists "fotos-pedidos: subida publica" on storage.objects;
create policy "fotos-pedidos: subida publica"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'fotos-pedidos');

-- Solo el admin autenticado puede listar/ver, reemplazar o borrar fotos.
drop policy if exists "fotos-pedidos: lectura solo admin" on storage.objects;
create policy "fotos-pedidos: lectura solo admin"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'fotos-pedidos');

drop policy if exists "fotos-pedidos: gestion solo admin" on storage.objects;
create policy "fotos-pedidos: gestion solo admin"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'fotos-pedidos' and public.es_admin_editor());

drop policy if exists "fotos-pedidos: borrado solo admin" on storage.objects;
create policy "fotos-pedidos: borrado solo admin"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'fotos-pedidos' and public.es_admin_editor());

-- ------------------------------------------------------------
-- 5. SEED — catalogo actual (los 4 productos ya construidos)
-- ------------------------------------------------------------

insert into public.productos
  (slug, nombre, categoria, categorias, precio_base, descripcion_corta, descripcion, emoji, destacado, personalizacion, peso_gramos)
values
  ('llavero-de-bebe', 'Llavero de bebé', 'recuerdos-personalizados',
   array['recuerdos-personalizados', 'llaveros'], 1200,
   'Un recuerdo tierno con la foto de tu bebé.',
   'Llavero artesanal en resina con la fotografía de tu bebé y sus datos de nacimiento, para llevar ese recuerdo siempre contigo.',
   '👶', true,
   '[
     {"id":"foto","label":"Foto del bebé","fields":[
       {"id":"foto-bebe","label":"Sube la foto","type":"photo","required":true,"helpText":"Preferiblemente con buena luz y fondo sencillo."}
     ]},
     {"id":"datos","label":"Datos del bebé","fields":[
       {"id":"color","label":"Color","type":"text","required":true,"maxLength":30,"placeholder":"Ej. Rosa pastel"},
       {"id":"hora","label":"Hora de nacimiento","type":"time","required":true},
       {"id":"fecha","label":"Fecha de nacimiento","type":"date","required":true},
       {"id":"nombre","label":"Nombre","type":"text","required":true,"maxLength":30},
       {"id":"talla","label":"Talla al nacer (cm)","type":"text","required":true,"maxLength":10,"placeholder":"Ej. 50 cm"},
       {"id":"peso","label":"Peso al nacer","type":"text","required":true,"maxLength":10,"placeholder":"Ej. 3,250 kg"}
     ]},
     {"id":"notas","label":"Notas adicionales","fields":[
       {"id":"nota","label":"Nota adicional","type":"text","required":false,"maxLength":200,"placeholder":"¿Alguna indicación adicional? (opcional)"}
     ]}
   ]'::jsonb, 15),
  ('marcapaginas-personalizado', 'Marcapáginas Personalizado', 'puntos-de-libro',
   array['puntos-de-libro'], 800,
   'El punto de libro perfecto con tu nombre o frase favorita.',
   'Marcapáginas de resina hecho a mano, personalizado con el texto que elijas: tu nombre, una frase o una dedicatoria.',
   '📖', true,
   '[
     {"id":"personalizacion","label":"Personalización","fields":[
       {"id":"color","label":"Color","type":"text","required":true,"maxLength":30,"placeholder":"Ej. Coral"},
       {"id":"texto","label":"Texto","type":"text","required":true,"maxLength":25,"placeholder":"Ej. Marta"}
     ]},
     {"id":"notas","label":"Notas adicionales","fields":[
       {"id":"nota","label":"Nota adicional","type":"text","required":false,"maxLength":200,"placeholder":"¿Alguna indicación adicional? (opcional)"}
     ]}
   ]'::jsonb, 20),
  ('llavero-de-letra', 'Llavero de letra', 'llaveros',
   array['llaveros'], 350,
   'Tu inicial o un nombre corto, en resina y color a elegir.',
   'Llavero de resina con la letra o nombre corto que elijas. Ideal para regalar o combinar con las llaves de toda la familia.',
   '🔑', true,
   '[
     {"id":"personalizacion","label":"Personalización","fields":[
       {"id":"letra","label":"Letra (forma del llavero)","type":"text","required":true,"maxLength":5,"placeholder":"Ej. M"},
       {"id":"nombre","label":"Nombre","type":"text","required":true,"maxLength":30,"placeholder":"Texto que irá dentro del llavero"},
       {"id":"color","label":"Color","type":"text","required":true,"maxLength":30,"placeholder":"Ej. Dorado"}
     ]},
     {"id":"notas","label":"Notas adicionales","fields":[
       {"id":"nota","label":"Nota adicional","type":"text","required":false,"maxLength":200,"placeholder":"¿Alguna indicación adicional? (opcional)"}
     ]}
   ]'::jsonb, 10),
  ('corazon-personalizado', 'Corazón personalizado', 'decoracion',
   array['decoracion', 'recuerdos-personalizados'], 2000,
   'Pieza con soporte y dos caras, cada una a tu gusto.',
   'Corazón de resina con soporte de exhibición. Cada una de sus dos caras se puede personalizar con texto, foto o ambos, para crear una pieza decorativa totalmente única.',
   '💗', true,
   '[
     {"id":"personalizacion","label":"Personalización","fields":[
       {"id":"parte-delantera","label":"Parte delantera","type":"text","required":true,"maxLength":40,"placeholder":"Texto para la parte delantera"},
       {"id":"parte-trasera","label":"Parte trasera","type":"text","required":true,"maxLength":40,"placeholder":"Texto para la parte trasera"},
       {"id":"imagen","label":"Imagen","type":"photo","required":true},
       {"id":"colores","label":"Colores","type":"text","required":true,"maxLength":40,"placeholder":"Ej. Rosa y dorado"}
     ]},
     {"id":"notas","label":"Notas adicionales","fields":[
       {"id":"nota","label":"Nota adicional","type":"text","required":false,"maxLength":200,"placeholder":"¿Alguna indicación adicional? (opcional)"}
     ]}
   ]'::jsonb, 60)
on conflict (slug) do update set
  nombre = excluded.nombre,
  categoria = excluded.categoria,
  categorias = excluded.categorias,
  precio_base = excluded.precio_base,
  descripcion_corta = excluded.descripcion_corta,
  descripcion = excluded.descripcion,
  emoji = excluded.emoji,
  destacado = excluded.destacado,
  personalizacion = excluded.personalizacion,
  peso_gramos = excluded.peso_gramos;

-- ------------------------------------------------------------
-- 6. ANALYTICS — visitas propias, sin depender de terceros (GA, etc.)
-- ------------------------------------------------------------

create table if not exists public.analytics_eventos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('pagina_vista', 'producto_vista')),
  ruta text not null,
  producto_slug text,
  duracion_ms integer, -- se rellena al salir de la pagina, puede quedar null
  creado_en timestamptz not null default now()
);

create index if not exists analytics_eventos_creado_en_idx on public.analytics_eventos (creado_en desc);
create index if not exists analytics_eventos_producto_slug_idx on public.analytics_eventos (producto_slug) where producto_slug is not null;

alter table public.analytics_eventos enable row level security;

-- Cualquier visitante (sin login) registra su propia visita y, al salir,
-- actualiza esa misma fila con cuanto tiempo estuvo. Sin datos personales:
-- ni IP, ni user agent, ni identificador de visitante.
drop policy if exists "analytics: registro publico" on public.analytics_eventos;
create policy "analytics: registro publico"
  on public.analytics_eventos for insert
  to anon, authenticated
  with check (true);

drop policy if exists "analytics: actualizacion publica de duracion" on public.analytics_eventos;
create policy "analytics: actualizacion publica de duracion"
  on public.analytics_eventos for update
  to anon, authenticated
  using (true)
  with check (true);

-- Solo el admin autenticado puede leer las estadisticas agregadas.
drop policy if exists "analytics: lectura solo admin" on public.analytics_eventos;
create policy "analytics: lectura solo admin"
  on public.analytics_eventos for select
  to authenticated
  using (true);

-- ------------------------------------------------------------
-- 7. CONSULTAS DE EVENTOS — encargos por volumen (bodas, comuniones...)
--    Esto NO es un pedido: es solo un contacto para presupuestar antes
--    de confirmar nada, se gestiona aparte de la tabla "pedidos".
-- ------------------------------------------------------------

create table if not exists public.consultas_eventos (
  id uuid primary key default gen_random_uuid(),
  creado_en timestamptz not null default now(),
  cliente_nombre text not null,
  cliente_email text not null,
  cliente_telefono text not null,
  producto_interes text not null,
  cantidad integer not null check (cantidad >= 15),
  fecha_evento date not null,
  fecha_entrega_deseada date not null,
  imagen_referencia text, -- ruta en el bucket fotos-eventos; null si no subieron foto
  descripcion text not null,
  atendida boolean not null default false
);

alter table public.consultas_eventos enable row level security;

-- El formulario publico puede crear la consulta, pero siempre sin marcar
-- como atendida (eso solo lo hace el admin desde el panel).
drop policy if exists "consultas_eventos: creacion publica" on public.consultas_eventos;
create policy "consultas_eventos: creacion publica"
  on public.consultas_eventos for insert
  to anon, authenticated
  with check (atendida = false);

drop policy if exists "consultas_eventos: lectura solo admin" on public.consultas_eventos;
create policy "consultas_eventos: lectura solo admin"
  on public.consultas_eventos for select
  to authenticated
  using (true);

drop policy if exists "consultas_eventos: actualizacion solo admin" on public.consultas_eventos;
create policy "consultas_eventos: actualizacion solo admin"
  on public.consultas_eventos for update
  to authenticated
  using (public.es_admin_editor())
  with check (public.es_admin_editor());

-- Foto de referencia opcional que el cliente sube al pedir presupuesto.
insert into storage.buckets (id, name, public)
values ('fotos-eventos', 'fotos-eventos', false)
on conflict (id) do nothing;

drop policy if exists "fotos-eventos: subida publica" on storage.objects;
create policy "fotos-eventos: subida publica"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'fotos-eventos');

drop policy if exists "fotos-eventos: lectura solo admin" on storage.objects;
create policy "fotos-eventos: lectura solo admin"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'fotos-eventos');

drop policy if exists "fotos-eventos: gestion solo admin" on storage.objects;
create policy "fotos-eventos: gestion solo admin"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'fotos-eventos' and public.es_admin_editor());

drop policy if exists "fotos-eventos: borrado solo admin" on storage.objects;
create policy "fotos-eventos: borrado solo admin"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'fotos-eventos' and public.es_admin_editor());

-- ------------------------------------------------------------
-- 8. MENSAJES DE CONTACTO — formulario general de /contacto
-- ------------------------------------------------------------

create table if not exists public.mensajes_contacto (
  id uuid primary key default gen_random_uuid(),
  creado_en timestamptz not null default now(),
  nombre text not null,
  email text not null,
  mensaje text not null,
  atendido boolean not null default false
);

alter table public.mensajes_contacto enable row level security;

drop policy if exists "mensajes_contacto: creacion publica" on public.mensajes_contacto;
create policy "mensajes_contacto: creacion publica"
  on public.mensajes_contacto for insert
  to anon, authenticated
  with check (atendido = false);

drop policy if exists "mensajes_contacto: lectura solo admin" on public.mensajes_contacto;
create policy "mensajes_contacto: lectura solo admin"
  on public.mensajes_contacto for select
  to authenticated
  using (true);

drop policy if exists "mensajes_contacto: actualizacion solo admin" on public.mensajes_contacto;
create policy "mensajes_contacto: actualizacion solo admin"
  on public.mensajes_contacto for update
  to authenticated
  using (public.es_admin_editor())
  with check (public.es_admin_editor());

-- ------------------------------------------------------------
-- 9. CONSULTA PUBLICA DE PEDIDOS — /mi-pedido (referencia + email)
--    La tabla "pedidos" sigue sin lectura publica (tiene datos de
--    contacto de todos los clientes). En vez de eso, esta funcion
--    "security definer" devuelve como mucho una fila, y solo si
--    coinciden EXACTAMENTE la referencia y el email — no es una
--    consulta abierta a la tabla.
-- ------------------------------------------------------------

alter table public.pedidos add column if not exists referencia text;

update public.pedidos set referencia = upper(left(id::text, 8)) where referencia is null;

alter table public.pedidos alter column referencia set not null;

create unique index if not exists pedidos_referencia_idx on public.pedidos (referencia);

drop function if exists public.buscar_pedido(text, text);

create function public.buscar_pedido(p_referencia text, p_email text)
returns table (
  referencia text,
  estado text,
  pago_estado text,
  creado_en timestamptz,
  items jsonb,
  subtotal_cents integer,
  zona_envio text,
  peso_total_gramos integer,
  envio_cents integer,
  total_cents integer
)
language sql
security definer
set search_path = public
as $$
  select p.referencia, p.estado, p.pago_estado, p.creado_en, p.items, p.subtotal_cents, p.zona_envio, p.peso_total_gramos, p.envio_cents, p.total_cents
  from public.pedidos p
  where p.referencia = upper(trim(p_referencia))
    and lower(p.cliente_email) = lower(trim(p_email))
  limit 1;
$$;

revoke all on function public.buscar_pedido(text, text) from public;
grant execute on function public.buscar_pedido(text, text) to anon, authenticated;

-- ------------------------------------------------------------
-- 10. LEADS DEL AGENTE VIRTUAL — contacto capturado por el widget de
--     chat flotante (respuestas predefinidas por palabras clave, sin
--     LLM). "contacto" es el email o telefono tal cual lo escribio el
--     visitante; "contexto" guarda su ultimo mensaje antes de que se
--     le pidiera el contacto, para dar pistas de que necesitaba.
-- ------------------------------------------------------------

create table if not exists public.leads_agente (
  id uuid primary key default gen_random_uuid(),
  creado_en timestamptz not null default now(),
  nombre text not null,
  contacto text not null,
  contexto text,
  atendido boolean not null default false
);

alter table public.leads_agente enable row level security;

drop policy if exists "leads_agente: creacion publica" on public.leads_agente;
create policy "leads_agente: creacion publica"
  on public.leads_agente for insert
  to anon, authenticated
  with check (atendido = false);

drop policy if exists "leads_agente: lectura solo admin" on public.leads_agente;
create policy "leads_agente: lectura solo admin"
  on public.leads_agente for select
  to authenticated
  using (true);

drop policy if exists "leads_agente: actualizacion solo admin" on public.leads_agente;
create policy "leads_agente: actualizacion solo admin"
  on public.leads_agente for update
  to authenticated
  using (public.es_admin_editor())
  with check (public.es_admin_editor());

-- ------------------------------------------------------------
-- 11. NOTAS DE CLIENTES — CRM basico en /admin, sin login de cliente.
--     No hay tabla de "clientes": el panel agrupa los pedidos existentes
--     por email (o telefono, si el email no coincide) al vuelo. Esta
--     tabla solo guarda las observaciones manuales del admin sobre cada
--     cliente, vinculadas por email.
-- ------------------------------------------------------------

create table if not exists public.notas_clientes (
  email text primary key,
  notas text not null default '',
  -- Etiquetas libres del admin (ej. "recurrente", "VIP", "evento grande"),
  -- se muestran como chips en la lista y en la ficha del cliente.
  etiquetas text[] not null default '{}',
  actualizado_en timestamptz not null default now()
);

-- Para proyectos donde la tabla ya existia antes de esta columna.
alter table public.notas_clientes add column if not exists etiquetas text[] not null default '{}';

alter table public.notas_clientes enable row level security;

-- Dato puramente interno del admin: sin acceso publico. Cualquier autenticado
-- (admin o demo) puede leerlas, pero solo un admin editor puede escribirlas
-- (la politica "for all" de abajo cubre insert/update/delete; select ya
-- queda permitido por la politica de lectura, y en Postgres las politicas
-- permisivas se combinan con OR).
drop policy if exists "notas_clientes: solo admin" on public.notas_clientes;

drop policy if exists "notas_clientes: lectura autenticada" on public.notas_clientes;
create policy "notas_clientes: lectura autenticada"
  on public.notas_clientes for select
  to authenticated
  using (true);

drop policy if exists "notas_clientes: escritura solo admin editor" on public.notas_clientes;
create policy "notas_clientes: escritura solo admin editor"
  on public.notas_clientes for all
  to authenticated
  using (public.es_admin_editor())
  with check (public.es_admin_editor());
