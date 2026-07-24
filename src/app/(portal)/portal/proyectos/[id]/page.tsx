import { PortalProjectDetail } from "@/components/portal/PortalProjectDetail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PortalProjectDetail projectId={id} />;
}
