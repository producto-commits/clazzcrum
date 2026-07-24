# Despliegue de Clazz en el VPS (Hostinger)

App **Next.js 16 + Prisma 7 + PostgreSQL + MinIO**. Todo corre en contenedores.
La base de datos, las **tablas, esquemas y relaciones** se crean solas al arrancar
(`prisma migrate deploy` aplica las 9 migraciones); el primer arranque también
crea **roles, permisos y el usuario admin** (seed).

## Qué NO exponer a Internet
- PostgreSQL y MinIO quedan en la red interna del compose. Solo se publica la app.
- El proxy del VPS (Easypanel/Traefik/nginx) da el dominio + certificado TLS.

---

## Opción A — Easypanel (recomendada, como Klientia)

1. En Easypanel: **Create Project** → `clazz`.
2. Añade un servicio **App** desde el código (Git) o desde este Dockerfile.
   - Si no hay repo Git: crea uno privado y sube `clazz-platform/`, o usa la
     opción de subir por Docker Compose pegando `docker-compose.prod.yml`.
3. Añade servicios **PostgreSQL** y **MinIO** (o usa el compose que ya los define).
4. Carga las variables de entorno de `.env.production.example` (con valores reales).
5. Deja `RUN_SEED=true` para el **primer** despliegue; luego cámbialo a `false`.
6. Asigna el **dominio** (p. ej. `app.clazz.digital`) al servicio app, puerto 3000.
   Easypanel gestiona el TLS.
7. Deploy. Revisa el log: debe decir "Aplicando migraciones…" y "Iniciando la aplicación…".

## Opción B — Docker Compose directo (por SSH)

```bash
# En el VPS, dentro de la carpeta del proyecto:
cp .env.production.example .env      # y completa TODOS los valores
docker compose -f docker-compose.prod.yml up -d --build

# Ver el arranque (migraciones + seed):
docker compose -f docker-compose.prod.yml logs -f app
```

Después del primer arranque, edita `.env` y pon `RUN_SEED=false`, luego:
```bash
docker compose -f docker-compose.prod.yml up -d
```

Publica el puerto 3000 detrás de nginx/Traefik con tu dominio y TLS.

---

## Verificación
- `https://TU_DOMINIO/login` carga (marca verde Clazz).
- Entra con `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.
- Sube un adjunto en una historia → confirma que MinIO guarda (bucket se crea solo).

## Notas
- **Secretos**: genera cada uno con `openssl rand -base64 48`. No reutilices los de desarrollo.
- **Correo**: si `MAIL_*` queda vacío, el OTP se imprime en el log del contenedor
  (útil para el primer login; configura SMTP real cuando lo tengas).
- **Backups**: respalda el volumen `clazz_db_data` (Postgres) periódicamente.
- **Actualizaciones**: `docker compose -f docker-compose.prod.yml up -d --build`
  vuelve a aplicar migraciones nuevas automáticamente.
