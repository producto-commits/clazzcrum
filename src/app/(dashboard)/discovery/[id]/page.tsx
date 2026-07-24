import { DesignDocWizard } from "@/components/discovery/DesignDocWizard";

export default async function DesignDocPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DesignDocWizard docId={id} />;
}
