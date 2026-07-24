// Estructura del cuestionario de discovery → documento de diseño (tipo SRS).
// Cada sección es un campo de texto libre (multilínea). Las respuestas se
// guardan como { [key]: string }.

export type DesignSection = {
  key: string;
  title: string;
  help: string;
  placeholder: string;
  confidential?: boolean; // marcada como interna en el PDF
};

export const DESIGN_SECTIONS: DesignSection[] = [
  {
    key: "general",
    title: "1. Información general",
    help: "Nombre del proyecto, cliente, fecha y responsables.",
    placeholder: "Proyecto: …\nCliente: …\nFecha: …\nResponsables: …",
  },
  {
    key: "objetivos",
    title: "2. Objetivos y alcance",
    help: "Qué incluye el proyecto y qué queda explícitamente fuera de alcance.",
    placeholder: "Objetivos:\n- …\n\nDentro de alcance:\n- …\n\nFuera de alcance:\n- …",
  },
  {
    key: "contexto",
    title: "3. Contexto / estado actual",
    help: "Qué existe hoy (si aplica) y el problema a resolver.",
    placeholder: "Situación actual…\nProblema a resolver…",
  },
  {
    key: "usuarios",
    title: "4. Usuarios y roles",
    help: "Tipos de usuario y roles del sistema a construir.",
    placeholder: "- Administrador: …\n- Cliente: …\n- …",
  },
  {
    key: "funcionales",
    title: "5. Requerimientos funcionales",
    help: "Lista de funcionalidades (una por línea).",
    placeholder: "- El sistema permite …\n- El usuario puede …",
  },
  {
    key: "no_funcionales",
    title: "6. Requerimientos no funcionales",
    help: "Seguridad, rendimiento, escalabilidad, disponibilidad.",
    placeholder: "- Seguridad: …\n- Rendimiento: …\n- Escalabilidad: …",
  },
  {
    key: "stack",
    title: "7. Stack tecnológico propuesto",
    help: "Frontend, backend, base de datos, hosting, integraciones de terceros.",
    placeholder: "- Frontend: …\n- Backend: …\n- Base de datos: …\n- Hosting: …",
  },
  {
    key: "arquitectura",
    title: "8. Arquitectura (alto nivel)",
    help: "Descripción de la arquitectura general de la solución.",
    placeholder: "Descripción de componentes y su interacción…",
  },
  {
    key: "cronograma",
    title: "9. Cronograma estimado",
    help: "Fases o sprints estimados con fechas.",
    placeholder: "- Fase 1 (fechas): …\n- Fase 2 (fechas): …",
  },
  {
    key: "entregables",
    title: "10. Entregables por fase",
    help: "Qué se entrega en cada fase.",
    placeholder: "- Fase 1: …\n- Fase 2: …",
  },
  {
    key: "riesgos",
    title: "11. Riesgos y supuestos",
    help: "Riesgos identificados y supuestos del proyecto.",
    placeholder: "Riesgos:\n- …\n\nSupuestos:\n- …",
  },
  {
    key: "presupuesto",
    title: "12. Estimación de horas / presupuesto",
    help: "Opcional. Se marca como confidencial (solo interno) en el PDF.",
    placeholder: "Horas estimadas: …\nPresupuesto: …",
    confidential: true,
  },
];
