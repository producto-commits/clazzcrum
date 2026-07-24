import { PortalDocDetail } from "@/components/portal/PortalDocDetail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PortalDocDetail docId={id} />;
}
