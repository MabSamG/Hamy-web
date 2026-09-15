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
-- 1. PRODUCTOS — catalogo publico
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
  creado_en timestamptz not null default now()
);

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
-- 2. PEDIDOS — cada pedido con su personalizacion en JSON
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
-- 3. STORAGE — fotos que suben los clientes al personalizar
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
-- 4. SEED — catalogo actual (los 4 productos ya construidos)
-- ------------------------------------------------------------

insert into public.productos
  (slug, nombre, categoria, categorias, precio_base, descripcion_corta, descripcion, emoji, destacado)
values
  ('llavero-de-bebe', 'Llavero de bebé', 'recuerdos-personalizados',
   array['recuerdos-personalizados', 'llaveros'], 1200,
   'Un recuerdo tierno con la foto de tu bebé.',
   'Llavero artesanal en resina con la fotografía de tu bebé y sus datos de nacimiento, para llevar ese recuerdo siempre contigo.',
   '👶', true),
  ('marcapaginas-personalizado', 'Marcapáginas Personalizado', 'puntos-de-libro',
   array['puntos-de-libro'], 800,
   'El punto de libro perfecto con tu nombre o frase favorita.',
   'Marcapáginas de resina hecho a mano, personalizado con el texto que elijas: tu nombre, una frase o una dedicatoria.',
   '📖', true),
  ('llavero-de-letra', 'Llavero de letra', 'llaveros',
   array['llaveros'], 350,
   'Tu inicial o un nombre corto, en resina y color a elegir.',
   'Llavero de resina con la letra o nombre corto que elijas. Ideal para regalar o combinar con las llaves de toda la familia.',
   '🔑', true),
  ('corazon-personalizado', 'Corazón personalizado', 'decoracion',
   array['decoracion', 'recuerdos-personalizados'], 2000,
   'Pieza con soporte y dos caras, cada una a tu gusto.',
   'Corazón de resina con soporte de exhibición. Cada una de sus dos caras se puede personalizar con texto, foto o ambos, para crear una pieza decorativa totalmente única.',
   '💗', true)
on conflict (slug) do update set
  nombre = excluded.nombre,
  categoria = excluded.categoria,
  categorias = excluded.categorias,
  precio_base = excluded.precio_base,
  descripcion_corta = excluded.descripcion_corta,
  descripcion = excluded.descripcion,
  emoji = excluded.emoji,
  destacado = excluded.destacado;
