-- 020 · Cerrar el acceso público a las tablas (Supabase PostgREST)
--
-- QUÉ PASABA (verificado el 2026-10-16, no es cosmético):
-- El proyecto de Supabase tenía el esquema `public` expuesto por PostgREST con RLS desactivado,
-- y Supabase concede `anon`/`authenticated` privilegios sobre `public` por defecto. La `anon` key
-- **se envía al navegador** (es `NEXT_PUBLIC_...`), así que cualquiera podía, sin autenticarse:
--   · LEER `usuario` (7 correos y roles del equipo real), `solicitud`, `cotizacion`, ...
--   · ESCRIBIR: un `POST /rest/v1/_migraciones` devolvía 201 (INSERT anónimo).
--   · Y `link_publico.token` quedaba al alcance: bastaba para abrir comparativas ajenas.
-- Comprobado con peticiones reales: `content-range: */7` en `usuario`, 201 en el POST.
--
-- CÓMO SE CIERRA:
--  1. `ENABLE ROW LEVEL SECURITY` en todas las tablas de `public`, **sin políticas**. Sin políticas
--     no hay fila visible ni escribible para quien no sea el dueño: es deny-all.
--  2. Revocar los privilegios de `anon`/`authenticated` sobre el esquema y sobre los objetos
--     actuales, y quitar los privilegios por defecto para que las tablas FUTURAS no se concedan
--     solas (esto es lo que evita repetir el problema en cada migración nueva).
--
-- POR QUÉ NO ROMPE LA APP:
--  La aplicación **no usa PostgREST** (cero `supabase.from(...)`): la sesión con Supabase es solo
--  para Auth, y los datos se leen y escriben con `pg` sobre `DATABASE_URL`, conectándose como el
--  **dueño** de las tablas. En Postgres, RLS no se aplica al dueño, así que la app no se enterra.
--  En consecuencia: NO se usa `FORCE ROW LEVEL SECURITY` (aplicaría RLS al dueño y sí la rompería).
--  Verificado: 510/510 tests siguen pasando con RLS activo.
--
-- Aplicar en Supabase: este archivo se corre tal cual (mismo runner). Mientras la migración a
-- Supabase siga pendiente (B1), hay que pegarlo en el SQL Editor del proyecto para cerrar el hueco,
-- porque la exposición es en el proyecto en la nube, no en la base local.

-- 1) RLS deny-all en todas las tablas de `public`.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

-- 2) Quitarle a `anon` y `authenticated` todo acceso al esquema y a los objetos existentes.
--    (Los roles existen en Supabase; en bases locales puede que no, de ahí el guard.)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;
    REVOKE ALL ON SCHEMA public FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;
    REVOKE ALL ON SCHEMA public FROM authenticated;
  END IF;
END $$;

-- 3) Que las tablas futuras no vuelvan a nacer concedidas a `anon`/`authenticated`.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
  END IF;
END $$;
