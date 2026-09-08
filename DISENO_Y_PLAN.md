# Plataforma SCRUM + Mesa de Servicio — Diseño y Plan

> Documento de arquitectura y plan de fases. **Aún no se ha escrito código de la aplicación.**
> Estado: propuesta pendiente de validación con Diego.
> Fecha: 2026-07-23

---

## 1. Comparación de stacks

| Criterio | **A) Next.js full-stack (RECOMENDADO)** | B) NestJS API + React (Vite) | C) Django + DRF |
|---|---|---|---|
| Lenguaje | TypeScript (front + back) | TypeScript (front + back) | Python (back) + TS (front) |
| Piezas a mantener | **1 app** (monolito modular) | 2 apps (API + SPA) | 2 apps (API + SPA) |
| API-first / webhooks | Route Handlers `/api/*` limpios | Excelente (nativo) | Excelente (DRF) |
| RBAC / admin / auditoría | Se construye (a la medida) | Se construye | **Casi gratis** (admin + permisos) |
| Kanban drag&drop, gráficos | React nativo | React nativo | Requiere front aparte igual |
| Curva para 1 dev | **Baja** (ya lo usas) | Media (más boilerplate) | Media-alta (otro ecosistema) |
| Encaja con tu infra actual | **Sí** (Easypanel, Postgres, Prisma) | Sí | Parcial |
| Despliegue | 1 contenedor en Easypanel | 2 servicios | 2 servicios |

**Recomendación: Opción A.** Reutiliza exactamente lo que ya dominas (Next.js + Prisma + PostgreSQL + Easypanel), es **una sola cosa que mantener** para un equipo de 1, y sigue siendo API-first: toda la lógica vive detrás de `/api/*`, así que si mañana quieres conectar GoHighLevel u otro CRM, solo expones esos endpoints (o un webhook) sin reescribir nada.

### Stack recomendado en detalle
- **Frontend + Backend:** Next.js (App Router) con Route Handlers como capa API.
- **Base de datos:** PostgreSQL.
- **ORM:** Prisma.
- **Auth:** JWT propio (access + refresh) con contraseñas en Argon2/bcrypt. OTP por correo.
- **Correo (OTP + notificaciones):** proveedor SMTP/transaccional (Zoho/ZeptoMail o Resend).
- **Archivos adjuntos:** almacenamiento de objetos S3-compatible (Cloudflare R2 / Backblaze B2 / MinIO), URLs firmadas.
- **Tiempo real (notificaciones in-app):** Server-Sent Events o WebSocket ligero.
- **Reportes PDF/Excel:** generación server-side (PDF con plantilla HTML→PDF; Excel con librería de hojas).
- **UI:** React + Tailwind + una librería de tabla/kanban (drag&drop).
- **Hosting:** Easypanel sobre VPS (como tus otros proyectos).

---

## 2. Modelo de datos (entidades y relaciones)

### Diagrama (alto nivel)

```
User ──< UserRole >── Role ──< RolePermission >── Permission
  │
  │ (assignee)
  ▼
Client 1──< Project 1──< Epic 1──< UserStory 1──< Task
  │            │                        │  │
  │            │                        │  └──< StoryAssignee >── User
  │            └──< Sprint 1──< UserStory (sprintId)
  │
  └──< Ticket 1──< TicketMessage (público / nota interna)
             │
             └──(opcional)── UserStory   (trazabilidad soporte→historia)

UserStory / Ticket / DesignDoc  ──< Attachment
Todo cambio relevante ──> AuditLog
Notification >── User
SLAPolicy ── define tiempos por prioridad
DesignDoc 1──< DesignDocVersion   (versionado v1,v2,v3)
```

### Entidades

**Auth / RBAC**
- **User**: id, email, passwordHash, name, isActive, emailVerifiedAt, createdAt.
- **Role**: id, key (`admin`|`client`|`developer`|`tech_lead`...), name.
- **Permission**: id, action (`create|read|edit|delete`), resource (`project|story|ticket|user|sla`...). Permisos **granulares por acción+recurso**, no solo por rol.
- **UserRole** (N:M User↔Role), **RolePermission** (N:M Role↔Permission).
- **OtpCode**: id, userId, codeHash, purpose (`verify`|`reset`), expiresAt, usedAt, attempts, lastSentAt. (Un solo uso, expiración 10–15 min, cooldown 60s.)
- **RefreshToken**: id, userId, tokenHash, expiresAt, revokedAt.
- **AuditLog**: id, userId, action, resource, resourceId, metadata(json), createdAt, ip.

**SCRUM**
- **Client**: id, name, contactos, notas.
- **Project**: id, clientId, name, description, startDate, endDate (estimada/real), status, responsables.
- **Epic**: id, projectId, title, description, priority, status.
- **UserStory**: id, epicId, projectId(denorm), clientId(denorm), asRole/iWant/soThat, priority, storyPoints, estimateHours, spentHours, status (Backlog/Planeado/En ejecución/QA/Bloqueado/Completado), sprintId(nullable), fechas, tags[], acceptanceCriteria(checklist).
- **Task**: id, storyId, title, done, assigneeId, estimate, spent.
- **StoryAssignee** (N:M UserStory↔User).
- **Sprint**: id, projectId, name, startDate, endDate, goal, capacity.
- **TimeEntry** (opcional para time tracking fino): id, storyId/taskId, userId, minutes, date, note.
- **Comment**: id, storyId, userId, body, createdAt (hilo de conversación).

**Mesa de Servicio**
- **Ticket**: id, clientId, reporterUserId, subject, description, priority, category, status (Nuevo/Asignado/En proceso/En espera del cliente/Resuelto/Cerrado/Reabierto), assigneeId, slaPolicyId, firstResponseDueAt, resolutionDueAt, firstRespondedAt, resolvedAt, linkedStoryId(nullable), csatScore(nullable).
- **TicketMessage**: id, ticketId, userId, body, visibility (`public`|`internal`), createdAt.
- **TicketCategory**: id, name (configurable por admin).
- **SLAPolicy**: id, priority, firstResponseMins, resolutionMins (configurable).

**Discovery / Documento de diseño**
- **DesignDoc**: id, projectId, status (`draft`|`enviado`|`aprobado`), currentVersion.
- **DesignDocVersion**: id, designDocId, version(int), answers(json de las 12 secciones), generatedFileUrl, createdAt, changeNote.

**Transversal**
- **Attachment**: id, entityType, entityId, fileName, mimeType, size, storageKey, uploadedBy. (Para historias, tareas, tickets, doc de diseño.)
- **Notification**: id, userId, type, payload(json), readAt, createdAt (in-app + espejo por correo).

---

## 3. Estructura de carpetas (propuesta)

```
plataforma/
├─ prisma/
│  └─ schema.prisma
├─ src/
│  ├─ app/
│  │  ├─ (auth)/login, register, verify-otp, reset
│  │  ├─ (dashboard)/            # vistas por rol
│  │  │  ├─ admin/ client/ developer/
│  │  ├─ scrum/                  # tablero kanban, sprints, backlog
│  │  ├─ service-desk/           # tickets
│  │  ├─ discovery/              # wizard del documento de diseño
│  │  └─ api/                    # ← capa API-first (REST)
│  │     ├─ auth/ users/ clients/ projects/ epics/
│  │     ├─ stories/ sprints/ tickets/ sla/
│  │     ├─ design-docs/ notifications/
│  │     └─ webhooks/            # (preparado, aún vacío)
│  ├─ server/
│  │  ├─ services/               # lógica de negocio
│  │  ├─ auth/                   # jwt, rbac guard, otp
│  │  ├─ audit/  notifications/  files/  reports/
│  │  └─ db.ts                   # cliente Prisma
│  ├─ components/                # UI (kanban, tablas, gráficos)
│  ├─ lib/  hooks/  i18n/        # textos centralizados (es por defecto)
│  └─ types/
├─ .env
└─ README.md
```

Clave: **toda** operación pasa por `src/app/api/*` (contrato REST claro) y la UI solo consume esa API. Eso garantiza el diseño desacoplado / API-first y deja `api/webhooks/` listo para integraciones futuras.

---

## 4. Plan de construcción por fases

| Fase | Entrega | Incluye |
|---|---|---|
| **0. Cimientos** ✅ | Esqueleto + BD | Proyecto Next.js, Prisma, PostgreSQL, esquema base, seed, i18n (es), layout responsive — **HECHO 2026-07-23, verificado E2E en navegador** (app en `clazz-platform/`) |
| **1. Auth + Roles (RBAC)** ✅ | Entrar seguro | Registro, OTP por correo (exp. 15min, cooldown 60s, 1 solo uso, máx 5 intentos), login JWT (access+refresh con rotación), recuperación, RBAC granular, AuditLog — **HECHO 2026-07-23, verificado E2E** (login admin, registro→OTP→dashboard, filtrado por rol) |
| **2. SCRUM** ✅ | Gestión ágil | Clientes, proyectos, épicas, historias, tareas, sprints, **tablero Kanban drag&drop** (6 estados), filtros, comentarios, criterios (DoD), time tracking, aislamiento multi-cliente — **HECHO 2026-07-23, verificado E2E**. Pendiente menor: adjuntos (MinIO), se harán junto a los de tickets/doc |
| **3. Mesa de Servicio** ✅ | Soporte | Tickets (7 estados), mensajes público/interno, categorías, **SLA** con indicadores de vencimiento, asignación, CSAT, vínculo ticket→historia — **HECHO 2026-07-23, verificado E2E** (crear caso, respuesta→SLA cumplido, nota interna, asignar, convertir a historia) |
| **4. Discovery / Doc de diseño** ✅ | Wizard SRS | Cuestionario por pasos (12 secciones), borrador editable, **export PDF** (react-pdf), versionado v1/v2/v3 con notas, estados Borrador/Enviado/Aprobado — **HECHO 2026-07-23, verificado E2E** (crear, llenar, guardar, PDF 200/válido, marcar enviado, versión 2) |
| **5. Dashboards + pulido** 🔶 | Métricas y cierre | **HECHO (dashboards) 2026-07-23, verificado E2E**: panel con métricas por rol, burndown, velocity, distribución de historias/casos, cumplimiento SLA, CSAT (gráficos SVG propios). **PENDIENTE (2º empuje):** adjuntos (MinIO), notificaciones in-app+correo, reportes exportables PDF/Excel, búsqueda avanzada |

Regla acordada: **cada fase se valida contigo antes de codear la siguiente.**

---

## 5. Decisiones tomadas (2026-07-23)

| # | Tema | Decisión |
|---|---|---|
| 1 | Stack | **Opción A** — Next.js full-stack, API-first, Prisma + PostgreSQL |
| 2 | Infra | **VPS Hostinger dedicado** (otro, distinto al de Klientia). Diego enviará la llave para instalar y crear BD y todo. |
| 3 | Correo (OTP + notif.) | Proyecto **independiente de Klientia**: no reutilizar nada. Correo aparte; Diego dará credenciales. |
| 4 | Archivos | A elección → **MinIO auto-alojado** en el mismo VPS (S3-compatible, sin costo extra, todo en un lugar). |
| 5 | Cliente-final | **Login propio al portal desde el día 1.** |
| 6 | Marca | Producto para **Clazz** (empresa que contrató). Logo/colores pendientes; entretanto neutros. |
| 7 | Export doc diseño | **Solo PDF.** |
| 8 | Idioma | Español, textos centralizados para traducir luego. |

### Pendientes de Diego (no bloquean el arranque local)
- Llave/acceso del VPS Hostinger (para instalar PostgreSQL + MinIO y desplegar).
- Credenciales del correo transaccional del proyecto (para OTP y notificaciones).
- (Opcional) Logo y colores de Clazz.
```
