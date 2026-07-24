import { redirect } from "next/navigation";

// Índice del portal → lleva a "Mis proyectos".
export default function PortalIndex() {
  redirect("/portal/proyectos");
}
