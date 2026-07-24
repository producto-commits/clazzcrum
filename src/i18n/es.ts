// Diccionario de textos en español (idioma por defecto).
// Todos los textos visibles se toman de aquí para facilitar una traducción
// futura sin tocar los componentes.

export const es = {
  app: {
    name: "Clazz",
    tagline: "Gestión ágil de proyectos y mesa de servicio",
  },
  common: {
    loading: "Cargando…",
    save: "Guardar",
    cancel: "Cancelar",
    create: "Crear",
    edit: "Editar",
    delete: "Eliminar",
    search: "Buscar",
    back: "Volver",
  },
  auth: {
    login: "Iniciar sesión",
    register: "Crear cuenta",
    logout: "Cerrar sesión",
    email: "Correo electrónico",
    password: "Contraseña",
    forgotPassword: "¿Olvidaste tu contraseña?",
    verifyOtp: "Verificar código",
    otpSent: "Te enviamos un código de 6 dígitos a tu correo",
  },
  nav: {
    dashboard: "Panel",
    projects: "Proyectos",
    board: "Tablero",
    sprints: "Sprints",
    serviceDesk: "Mesa de servicio",
    discovery: "Documento de diseño",
    clients: "Clientes",
    users: "Usuarios",
    reports: "Reportes",
    settings: "Configuración",
  },
  status: {
    story: {
      BACKLOG: "Backlog",
      PLANNED: "Planeado",
      IN_PROGRESS: "En ejecución",
      QA: "En pruebas / QA",
      BLOCKED: "Bloqueado",
      DONE: "Completado",
    },
    ticket: {
      NEW: "Nuevo",
      ASSIGNED: "Asignado",
      IN_PROGRESS: "En proceso",
      WAITING_CLIENT: "En espera del cliente",
      RESOLVED: "Resuelto",
      CLOSED: "Cerrado",
      REOPENED: "Reabierto",
    },
    priority: {
      LOW: "Baja",
      MEDIUM: "Media",
      HIGH: "Alta",
      CRITICAL: "Crítica",
    },
  },
} as const;

export type Dictionary = typeof es;
