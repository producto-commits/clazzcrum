#!/bin/sh
# Arranque del contenedor de la app: aplica migraciones y (opcional) siembra
# datos iniciales (roles, permisos, admin) antes de levantar el servidor.
set -e

echo "→ Aplicando migraciones de base de datos (prisma migrate deploy)…"
npx prisma migrate deploy

if [ "$RUN_SEED" = "true" ]; then
  echo "→ Sembrando datos iniciales (roles, permisos, admin)…"
  npx prisma db seed || echo "⚠ El seed falló o ya estaba aplicado; se continúa."
fi

echo "→ Iniciando la aplicación…"
exec "$@"
