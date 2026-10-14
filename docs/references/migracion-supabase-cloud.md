---
estado: listo-para-ejecutar
requiere: connection string de Supabase (pooler) + decision sobre los datos
fecha: 2026-10-14
---

# Migración de datos a Supabase Cloud

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
| RLS / policies | **Ninguna.** No hace falta configurar seguridad por fila (consistente con Q2: los coordinadores se ven entre ellos) |
| Tipos enumerados, `bytea`, `jsonb` | Todo estándar de Postgres 16 |
| Idempotencia | La tabla `_migraciones` evita re-aplicar. En una base nueva corren una vez en orden |

## ⚠️ El riesgo que hay que decidir antes

**Los tests de integración escriben en la base.** Crean solicitudes, cotizaciones y
comparativas de verdad, y borran cosas.

Si `DATABASE_URL` apunta a Supabase Cloud, entonces **`npm test` escribe en la base del
piloto**. Hoy eso es inofensivo porque la base es local; en la nube no lo es.

Tres salidas:

1. **Base de test aparte** (recomendado): un segundo proyecto Supabase gratuito, o un schema
   separado, solo para tests. `DATABASE_URL` para la app, `TEST_DATABASE_URL` para la suite.
   Es trabajo: hay que tocar los tests de integración para que usen esa variable.
2. **Correr los tests solo contra local**: la app apunta a la nube y los tests siguen usando
   `localhost`. Simple, pero hay que acordarse cada vez.
3. **Aceptarlo durante el piloto**: los tests ensucian la base real. **No lo recomiendo**: en
   `TASKS.md` 4.10.13 ya está anotado que la suite deja filas vivas que el botón de alertas
   toma como reales y manda correos por ellas.

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
- **El OCR**: `/api/convertir` depende de Python, que no existe en serverless → degrada a
  carga manual. Es el otro bloqueante de producción (2.2 del assessment de 009), y **migrar
  la base no lo arregla**.
