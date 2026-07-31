// Definición central de roles y permisos (RBAC granular por acción + recurso).
// Los permisos se otorgan por par (action, resource); los roles agrupan permisos.
// Esto permite crear roles nuevos (p. ej. "líder técnico") ajustando permisos
// sin tocar código.

export const ACTIONS = ["create", "read", "edit", "delete"] as const;
export type Action = (typeof ACTIONS)[number];

export const RESOURCES = [
  "client",
  "project",
  "epic",
  "story",
  "sprint",
  "task",
  "ticket",
  "sla",
  "design_doc",
  "user",
  "report",
] as const;
export type Resource = (typeof RESOURCES)[number];

export type RoleKey = "admin" | "client" | "developer" | "tech_lead";

// Matriz de permisos por rol. "*" = todas las acciones sobre el recurso.
// Un arreglo de acciones limita a esas acciones.
type RolePermissionMap = Record<
  RoleKey,
  Partial<Record<Resource, Action[] | "*">>
>;

export const ROLE_PERMISSIONS: RolePermissionMap = {
  admin: {
    client: "*",
    project: "*",
    epic: "*",
    story: "*",
    sprint: "*",
    task: "*",
    ticket: "*",
    sla: "*",
    design_doc: "*",
    user: "*",
    report: "*",
  },
  // Cliente-final: solo lectura de sus proyectos e historias; crea y lee sus tickets.
  client: {
    project: ["read"],
    epic: ["read"],
    story: ["read"],
    sprint: ["read"],
    ticket: ["create", "read"],
  },
  // Desarrollador: trabaja sus historias/tareas y los tickets asignados.
  // También puede planificar sus proyectos: crear hitos, fases y actividades
  // dentro de ellos (crear ≠ eliminar — borrar sigue reservado a admin/líder).
  developer: {
    client: ["read"], // necesario para elegir cliente al crear un ticket
    project: ["read"],
    epic: ["create", "read", "edit"],
    story: ["create", "read", "edit"],
    sprint: ["create", "read", "edit"],
    task: ["create", "read", "edit"],
    ticket: ["create", "read", "edit"],
    design_doc: ["create", "read", "edit"],
    report: ["read"],
  },
  // Líder técnico: como desarrollador, pero puede crear/planificar más.
  tech_lead: {
    client: ["read"],
    project: ["create", "read", "edit", "delete"],
    epic: ["create", "read", "edit", "delete"],
    story: ["create", "read", "edit", "delete"],
    sprint: ["create", "read", "edit", "delete"],
    task: ["create", "read", "edit", "delete"],
    ticket: ["create", "read", "edit"],
    design_doc: ["create", "read", "edit"],
    report: ["read"],
  },
};

export const ROLE_META: Record<RoleKey, { name: string; description: string }> = {
  admin: { name: "Administrador", description: "Control total del sistema" },
  client: { name: "Cliente", description: "Acceso de solo lectura a sus proyectos y creación de casos" },
  developer: { name: "Desarrollador", description: "Trabaja sus historias, tareas y tickets asignados" },
  tech_lead: { name: "Líder técnico", description: "Desarrollador con permisos de planificación" },
};
