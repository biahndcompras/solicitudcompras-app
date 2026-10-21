---
estado: ejecutado-2026-10-21
requiere: nada (ejecutado en limpio; ver "Resultado" abajo)
fecha: 2026-10-14
---

# Migración de datos a Supabase Cloud

> **Ejecutado el 2026-10-21 — esquema limpio.** Se hizo `DROP SCHEMA public CASCADE` y se
> corrieron las **21 migraciones** contra el pooler. Resultado: 18 tablas, **RLS 18/18**, 7
> usuarios del equipo, 24 campos de catálogo y 3 plantillas. PostgREST quedó cerrado (lectura y
> escritura anónimas → 401). Verificado con la app real: login, dashboard y un alta de solicitud
> (escrita y borrada). La suite usa `TEST_DATABASE_URL` (base local), no la del piloto.
> **Lo que falta es de despliegue**: cargar `DATABASE_URL` y las claves en Vercel.

Hoy el sistema es **híbrido**: la autenticación ya vive en Supabase Cloud
(`bgfsjaetvuwhrmipojnh.supabase.co`), pero **los datos siguen en Postgres local**
(`postgresql://ecalderonl@localhost:5432/bia`).

Esta migración mueve los datos. Es lo último que falta para que el piloto corra sin depender
de una máquina local.

## Lo que hace falta

### 1. El connection string del pooler

Supabase lo da en **Project Settings → Database → Connection string → Connection pooling**.
Tiene esta forma:

```
postgresql://postgres.bgfsjaetvuwhrmipojnh:<PASSWORD>@aws-0-<REGION>.pooler.supabase.com:6543/postgres
```

**Si no la tenés a mano**, se saca así:
1. Project Settings → Database → **Reset database password** (esto también cierra la
   exposición que quedó pendiente en `TASKS.md` §1 — se hace una vez y quedan las dos cosas
   resueltas).
2. Copiá la contraseña y armá la URL con el formato de arriba.
3. El `<REGION>` de este proyecto se ve en la misma pantalla.

**No me la pases por el chat.** La escribís vos en `.env.local`, en la línea `DATABASE_URL`,
y me avisás.

### 2. Decidir qué pasa con los datos actuales

Hay **168 solicitudes** en local (126 son de prueba: correos `@bia.hn` y `qa.*`). Dos caminos:

- **A — Esquema limpio.** Se corren las migraciones en Supabase y arranca vacío. Las
  migraciones ya traen los datos semilla: catálogo de campos, plantillas y los usuarios del
  equipo. **Recomendado para el piloto**: los datos locales son de desarrollo y arrastrarlos
  lleva basura a producción.
- **B — Migrar todo.** Se copian las 168 solicitudes con sus cotizaciones, comparativas y
  decisiones. Sirve si esas 42 "reales" son de verdad y querés conservarlas.

## Lo que verifiqué (para que la migración no falle a mitad)

| Comprobación | Resultado |
|---|---|
| Las migraciones crean esquema **y** datos semilla | ✅ catálogo, plantillas y equipo vienen incluidos |
| Dependencias de Supabase en el esquema | Solo `010`, que inserta los usuarios de auth. El resto es SQL estándar |
| RLS / policies | **Sí, la 020.** Es **deny-all** (sin políticas) para cerrar PostgREST: la app accede con `pg` como dueño y no usa PostgREST. No confundir con 4.4.3 (políticas por fila), que sigue pendiente. Ver B5 |
| Tipos enumerados, `bytea`, `jsonb` | Todo estándar de Postgres 16 |
| Idempotencia | La tabla `_migraciones` evita re-aplicar. En una base nueva corren una vez en orden |

## ✅ El riesgo de los tests ya está cerrado (2026-10-21)

**Los tests de integración escriben en la base.** Si `DATABASE_URL` apunta a Supabase Cloud,
`npm test` escribiría en la base del piloto.

**Ya está resuelto en código** (opción 1 del plan original):

- `lib/db/test-url.ts` decide contra qué base corren: `TEST_DATABASE_URL` manda; si no existe,
  solo se acepta `DATABASE_URL` cuando el host es **local**.
- `vitest.setup.ts`, `vitest.global-setup.ts` y los 6 tests de integración usan ese helper.
- Si `DATABASE_URL` es remota y no hay `TEST_DATABASE_URL`, la suite **omite** los tests de
  integración y **corta** `process.env.DATABASE_URL` antes de que algo pueda conectar.

Verificado: con `DATABASE_URL` remota (falsa) los 39 tests de integración se **omiten**; con
`TEST_DATABASE_URL` local, los 39 pasan contra la base de tests.

**Lo único que falta hacer:** crear la base de tests (local `bia_test`, o un proyecto Supabase
aparte) y poner su URL en `TEST_DATABASE_URL`. No hace falta para apuntar la app a la nube,
pero sí para correr integración después de migrar.

## Procedimiento, una vez decidido

```bash
# 1. Apuntar DATABASE_URL al pooler de Supabase (en .env.local)

# 2. Crear el esquema y los datos semilla
source .env.local && bash scripts/db-migrate.sh

# 3. Solo si se eligió migrar los datos (camino B):
#    pg_dump local -> pg_restore en Supabase, tabla por tabla, respetando el orden
#    de dependencias (solicitud antes que cotizacion, etc.)

# 4. Verificar
psql "$DATABASE_URL" -c "SELECT count(*) FROM campo_catalogo"   # 25
psql "$DATABASE_URL" -c "SELECT count(*) FROM usuario"          # los del equipo
```

## Verificación posterior (no me alcanza con que las migraciones corran)

1. **Login real**: entrar a `/panel` con una cuenta del equipo, contra la nube.
2. **Ciclo completo**: crear una solicitud de prueba y llevarla hasta el envío.
3. **Correo**: confirmar que sale `enviado` en la bitácora (no `fallido`).
4. **Los tests**: correr la suite y confirmar que **no** toca la base del piloto.
5. **Revisar que la base local no se use por error** en ningún camino.

## Qué queda pendiente después

- **Rotar la contraseña de Postgres** (`TASKS.md` B1): si se resetea al armar la URL, queda
  resuelto en el mismo movimiento.
- **RLS (migración 020)**: al aplicar el esquema hay que incluirla. Sin ella, PostgREST deja
  toda la base `public` accesible con la `anon` key (fue el hallazgo B5). Ya se aplicó a mano
  en el proyecto; el archivo tiene que quedar registrado en `_migraciones`.
- ~~El OCR~~: ✅ resuelto el 2026-10-17. `/api/convertir` ya no usa Python; convierte con un
  modelo multimodal de OpenRouter.
