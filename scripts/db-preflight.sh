#!/usr/bin/env bash
# Chequeo previo a migrar: dice a QUÉ base estás apuntando y en qué estado está.
#
# Se corre ANTES de `db-migrate.sh` para no descubrir a mitad de camino que el esquema ya
# existía (y que `_migraciones` no lo sabía). No modifica nada: solo lee.
#
# Uso:
#   DATABASE_URL="postgresql://..." bash scripts/db-preflight.sh
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL no está definida." >&2
  exit 1
fi
if ! command -v psql >/dev/null 2>&1; then
  echo "ERROR: no se encontró 'psql'." >&2
  exit 1
fi

# Nunca imprimir la contraseña.
SEGURO="$(printf '%s' "$DATABASE_URL" | sed -E 's#://[^@/]*@#://***@#')"
echo "Base destino: $SEGURO"
echo ""

psql "$DATABASE_URL" -At -c "select 'host: ' || coalesce(inet_server_addr()::text,'?') || '  db: ' || current_database() || '  user: ' || current_user;"

echo ""
echo "--- Migraciones registradas ---"
if psql "$DATABASE_URL" -At -c "select 1 from information_schema.tables where table_schema='public' and table_name='_migraciones';" | grep -q 1; then
  REGISTRADAS="$(psql "$DATABASE_URL" -At -c "select count(*) from _migraciones;")"
  echo "  registradas: $REGISTRADAS"
  psql "$DATABASE_URL" -At -c "select '  ' || nombre from _migraciones order by nombre;"
else
  echo "  (_migraciones NO existe: parece una base sin migrar)"
fi

echo ""
echo "--- Tablas en public ---"
psql "$DATABASE_URL" -At -c "select '  ' || count(*) || ' tablas' from information_schema.tables where table_schema='public' and table_type='BASE TABLE';"

echo ""
echo "--- RLS (protegidas/total) ---"
psql "$DATABASE_URL" -At -c "select '  ' || count(*) filter (where c.relrowsecurity) || ' / ' || count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r';"

echo ""
echo "--- Conteos clave ---"
for t in solicitud usuario cotizacion campo_catalogo plantilla _migraciones; do
  if psql "$DATABASE_URL" -At -c "select 1 from information_schema.tables where table_schema='public' and table_name='$t';" | grep -q 1; then
    N="$(psql "$DATABASE_URL" -At -c "select count(*) from $t;")"
    printf '  %-16s %s\n' "$t" "$N"
  else
    printf '  %-16s (no existe)\n' "$t"
  fi
done

echo ""
echo "Si 'registradas' es menor que el número de archivos en migrations/, NO corras db-migrate.sh"
echo "a ciegas: primero hay que decidir si se completa el registro o se recrea el esquema."
