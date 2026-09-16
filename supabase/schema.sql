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
  using (true)
  with check (true);

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
  creado_en timestamptz not null default now()
);

-- Para proyectos donde la tabla ya existia antes de esta columna.
alter table public.productos add column if not exists personalizacion jsonb not null default '[]'::jsonb;

alter table public.productos enable row level security;

drop policy if exists "productos: lectura publica" on public.productos;
create policy "productos: lectura publica"
  on public.productos for select
  to anon, authenticated
  using (true);

-- Solo un admin autenticado (Supabase Auth) puede crear/editar/borrar productos.
drop policy if exists "productos: escritura solo admin" on public.productos;
create policy "productos: escritura solo admin"
  on public.productos for all
  to authenticated
  using (true)
  with check (true);

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
  total_cents integer not null,
  notas text,
  stripe_payment_intent_id text
);

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
  using (true)
  with check (true);

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
  using (bucket_id = 'fotos-pedidos');

drop policy if exists "fotos-pedidos: borrado solo admin" on storage.objects;
create policy "fotos-pedidos: borrado solo admin"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'fotos-pedidos');

-- ------------------------------------------------------------
-- 5. SEED — catalogo actual (los 4 productos ya construidos)
-- ------------------------------------------------------------

insert into public.productos
  (slug, nombre, categoria, categorias, precio_base, descripcion_corta, descripcion, emoji, destacado, personalizacion)
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
   ]'::jsonb),
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
   ]'::jsonb),
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
   ]'::jsonb),
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
   ]'::jsonb)
on conflict (slug) do update set
  nombre = excluded.nombre,
  categoria = excluded.categoria,
  categorias = excluded.categorias,
  precio_base = excluded.precio_base,
  descripcion_corta = excluded.descripcion_corta,
  descripcion = excluded.descripcion,
  emoji = excluded.emoji,
  destacado = excluded.destacado,
  personalizacion = excluded.personalizacion;

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
  using (true)
  with check (true);

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
  using (bucket_id = 'fotos-eventos');

drop policy if exists "fotos-eventos: borrado solo admin" on storage.objects;
create policy "fotos-eventos: borrado solo admin"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'fotos-eventos');

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
  using (true)
  with check (true);
