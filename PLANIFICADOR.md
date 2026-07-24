# Motor de Planificación Inteligente (spec de Diego, 2026-07-23)

El usuario SOLO define: Hitos ▸ Fases ▸ Actividades (horas estimadas + responsable) y la
fecha de inicio del proyecto. El sistema calcula: fechas de inicio/fin por actividad,
fin estimado del proyecto, y GENERA LOS SPRINTS automáticamente (Sprint 1, 2, 3…)
mostrando qué hitos/actividades entran en cada uno. El sprint es consecuencia del
cálculo, no una asignación manual.

## Variables
1. Capacidad diaria por desarrollador (configurable, ej. 8 h/día) en módulo Equipo.
2. Dedicación por proyecto en % (suma 100%): capacidad efectiva = horas/día × %.
3. Horas estimadas por actividad: días = horas ÷ capacidad efectiva.
4. Eventos que restan capacidad del día: reuniones, tickets, incidentes
   (capacidad disponible = base − eventos del día). → tabla CapacityEvent
   (los tickets resueltos la alimentan automáticamente con su tiempo de ejecución).

## Replanificación automática al: crear/editar actividad (horas, responsable),
cambiar dedicación, registrar ticket/reunión, cambiar prioridad, nuevo proyecto.

## Sprints automáticos: duración configurable (días hábiles por proyecto),
se llenan según capacidad real y orden Hito→Fase→Actividad.

## Festivos: excluir festivos de Colombia (API api-colombia.com, cacheados en tabla
Holiday) + fines de semana. Solo se planifica en días hábiles.

## Equipo (config requerida): horas/día, horas/semana, disponibilidad; por proyecto:
% dedicación + prioridad (suma = 100%).

## Estado V1 (implementado): ver src/server/services/planning.ts
