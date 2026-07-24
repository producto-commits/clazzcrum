# Clazz — Plataforma SCRUM + Mesa de Servicio

App web (Next.js) para gestión ágil de proyectos y mesa de servicio.
Ver el diseño y plan de fases en [`../DISENO_Y_PLAN.md`](../DISENO_Y_PLAN.md).

## Stack

- **Next.js 16** (App Router) — frontend + API en `/api/*` (diseño API-first).
- **PostgreSQL** + **Prisma 7** (con driver adapter `@prisma/adapter-pg`).
- **MinIO** (S3-compatible) para archivos adjuntos.
- **bcryptjs** para contraseñas · JWT (Fase 1).
- **Tailwind CSS 4** · español por defecto (textos en `src/i18n/`).

## Requisitos

- Node 20+ y Docker (para PostgreSQL + MinIO locales).

## Puesta en marcha (local)

```bash
# 1. Variables de entorno
cp .env.example .env

# 2. Levantar base de datos y almacenamiento
npm run db:up

# 3. Instalar dependencias
npm install

# 4. Crear el esquema y sembrar datos base (roles, permisos, SLA, admin)
npm run db:migrate      # aplica migraciones
npm run db:seed         # crea roles/permisos/SLA/categorías + admin inicial

# 5. Arrancar la app
npm run dev             # http://localhost:3000
```

**Admin inicial (seed):** `admin@clazz.local` / `Admin12345!`
(configurable con `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`; cambiar tras el primer ingreso).

## Servicios locales

| Servicio | URL |
|---|---|
| App | http://localhost:3000 |
| Estado de salud (API) | http://localhost:3000/api/health |
| PostgreSQL | `localhost:5433` (usuario/clave `clazz`) |
| MinIO API | http://localhost:9000 |
| MinIO consola | http://localhost:9001 (`clazz_minio` / `clazz_minio_dev_password`) |

## Scripts útiles

| Script | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run db:up` / `db:down` | Levantar / apagar Docker (Postgres + MinIO) |
| `npm run db:migrate` | Crear/aplicar migraciones |
| `npm run db:seed` | Sembrar datos base |
| `npm run db:studio` | Prisma Studio (explorar la BD) |
| `npm run db:reset` | Reiniciar BD (borra datos) + re-migrar + re-sembrar |

## Estructura

```
src/
├─ app/            # páginas + rutas API (/api/*)
├─ server/         # lógica de servidor (db, rbac, servicios)
├─ i18n/           # textos (español)
└─ components/     # UI (a partir de la Fase 2)
prisma/
├─ schema.prisma   # modelo de datos completo
├─ migrations/     # historial de migraciones
└─ seed.ts         # datos base
prisma.config.ts   # configuración Prisma 7 (conexión, seed)
docker-compose.yml # Postgres + MinIO locales
```

## Autenticación (Fase 1)

Rutas API bajo `/api/auth/*`: `register`, `verify-otp`, `resend-otp`, `login`,
`logout`, `refresh`, `forgot-password`, `reset-password`, `me`.
Páginas: `/login`, `/register`, `/verify`, `/forgot-password`, `/reset-password`, `/dashboard`.

- OTP de 6 dígitos por correo (expira 15 min, cooldown 60s, un solo uso, máx 5 intentos).
- JWT access (15 min) + refresh (7 días, rotado y hasheado en BD) en cookies httpOnly.
- Protección de rutas en `src/proxy.ts`; guardas de permisos en `src/server/auth/guard.ts`.
- **Correo en modo dev:** si no hay SMTP configurado, el OTP se imprime en la consola del servidor.

## SCRUM (Fase 2)

Rutas API: `/api/clients`, `/api/projects`, `/api/epics`, `/api/stories`
(+ `/[id]/comments`, `/[id]/tasks`, `/[id]/criteria`), `/api/tasks/[id]`,
`/api/criteria/[id]`, `/api/sprints`, `/api/users`.
Páginas: `/clients`, `/projects`, `/projects/[id]` (workspace con tablero Kanban).

- Tablero Kanban con **arrastrar y soltar** (`@dnd-kit`), 6 estados.
- Historias con épica, sprint, prioridad, story points, estimado vs. real (time tracking),
  etiquetas, asignados, criterios de aceptación (DoD), subtareas y comentarios.
- Filtros por sprint, asignado, prioridad y búsqueda.
- **Aislamiento multi-cliente**: el rol `client` solo ve sus propios proyectos
  (ver `src/server/auth/scope.ts`).

## Mesa de Servicio (Fase 3)

Rutas API: `/api/tickets` (+ `/[id]`, `/[id]/messages`, `/[id]/csat`, `/[id]/convert`),
`/api/ticket-categories`, `/api/sla` (+ `/[id]`).
Páginas: `/service-desk`, `/service-desk/[id]`.

- Tickets con **7 estados**, categorías, prioridad, asignación.
- Respuestas **públicas** vs. **notas internas** (el cliente solo ve las públicas).
- **SLA** por prioridad: se calculan fechas objetivo al crear; indicadores
  Cumplido / En tiempo / Por vencer / Vencido. Config editable por admin (`/api/sla`).
- Auto-lógica: primera respuesta del staff marca SLA y pasa a "En proceso";
  el cliente respondiendo reabre un caso resuelto.
- **CSAT** (1-5) al resolver · **convertir caso → historia** de SCRUM (trazabilidad).

## Documento de diseño / Discovery (Fase 4)

Rutas API: `/api/design-docs` (+ `/[id]`, `/[id]/versions`, `/[id]/pdf`).
Páginas: `/discovery`, `/discovery/[id]` (asistente por pasos).

- Asistente (wizard) de **12 secciones** tipo SRS (`src/lib/designDocSections.ts`).
- Borrador editable con autoguardado manual; navegación por sección y progreso.
- **Export a PDF** profesional con `@react-pdf/renderer` (`src/server/pdf/designDocPdf.tsx`).
- **Versionado** (v1, v2, v3…) con nota de cambios e historial.
- Estados: Borrador / Enviado al cliente / Aprobado por el cliente.
- Módulo solo-staff (el cliente recibe el PDF; no edita).

## Dashboards y métricas (Fase 5)

Rutas API: `/api/metrics/overview`, `/api/metrics/scrum` (`?projectId=&sprintId=`).
- Panel principal (`/dashboard`) con métricas según rol: proyectos, historias en curso,
  casos abiertos, cumplimiento de SLA, CSAT, y distribución de historias/casos por estado.
- Métricas por proyecto (botón "Métricas" en el workspace): **velocity** por sprint,
  **burndown** (ideal vs restante) y distribución de historias.
- Gráficos SVG propios sin dependencias (`src/components/charts/Charts.tsx`).

## Adjuntos, evidencia y equipo (mejoras 2026-07-23)

- **Marca Clazz Digital** (verde). Logo circular en `src/components/brand/Logo.tsx`.
- **Historia de usuario** con responsable(s), descripción, horas estimadas/reales,
  fecha de inicio y fin, y **estado de cumplimiento** (rojo "Atrasada" si no se
  completó a tiempo — visible en el tablero y el detalle).
- **Evidencia obligatoria al completar**: al pasar a Completado se exige una
  descripción + un **adjunto** (se guarda en MinIO). API `/api/attachments`.
- **Equipo (`/admin/users`)**: el admin crea miembros (nombre, apellido, correo,
  contraseña, rol, cargo) y ajusta rol/estado.

## Estado

- ✅ **Fase 0 — Cimientos**.
- ✅ **Fase 1 — Autenticación + Roles**.
- ✅ **Fase 2 — SCRUM**.
- ✅ **Fase 3 — Mesa de Servicio**.
- ✅ **Fase 4 — Documento de diseño (Discovery)**.
- 🔶 **Fase 5 — Dashboards** hechos. **Pendiente (2º empuje):** adjuntos (MinIO),
  notificaciones in-app + correo, reportes exportables (PDF/Excel), búsqueda avanzada.
