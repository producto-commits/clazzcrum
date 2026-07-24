import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { DESIGN_SECTIONS } from "@/lib/designDocSections";

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 10.5, fontFamily: "Helvetica", color: "#1e293b", lineHeight: 1.5 },
  brandBar: { backgroundColor: "#4f46e5", color: "#ffffff", padding: 10, borderRadius: 4, marginBottom: 16 },
  brand: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", marginBottom: 4, color: "#0f172a" },
  meta: { fontSize: 9, color: "#64748b", marginBottom: 2 },
  metaRow: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#4f46e5",
    marginTop: 14,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingBottom: 3,
  },
  body: { color: "#334155" },
  empty: { color: "#94a3b8", fontStyle: "italic" },
  confidential: { fontSize: 8, color: "#d97706", marginBottom: 2 },
  footer: { position: "absolute", bottom: 24, left: 48, right: 48, fontSize: 8, color: "#94a3b8", textAlign: "center" },
});

type DocData = {
  title: string;
  version: number;
  status: string;
  projectName: string;
  clientName: string;
  answers: Record<string, string>;
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Borrador",
  SENT: "Enviado al cliente",
  APPROVED: "Aprobado por el cliente",
};

function DesignDocPDF({ data }: { data: DocData }) {
  const today = new Date().toLocaleDateString("es");
  return (
    <Document title={data.title}>
      <Page size="A4" style={styles.page}>
        <View style={styles.brandBar}>
          <Text style={styles.brand}>Clazz</Text>
        </View>

        <Text style={styles.title}>{data.title}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>Proyecto: {data.projectName}</Text>
          <Text style={styles.meta}>Cliente: {data.clientName}</Text>
          <Text style={styles.meta}>
            Versión {data.version} · {STATUS_LABEL[data.status] ?? data.status} · Generado {today}
          </Text>
        </View>

        {DESIGN_SECTIONS.map((s) => {
          const value = (data.answers?.[s.key] ?? "").trim();
          return (
            <View key={s.key} wrap={false}>
              <Text style={styles.sectionTitle}>{s.title}</Text>
              {s.confidential && <Text style={styles.confidential}>Confidencial · uso interno</Text>}
              {value ? (
                <Text style={styles.body}>{value}</Text>
              ) : (
                <Text style={styles.empty}>(Sin información)</Text>
              )}
            </View>
          );
        })}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) => `Clazz · ${data.title} · página ${pageNumber} de ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}

export async function renderDesignDocPdf(data: DocData): Promise<Buffer> {
  return renderToBuffer(<DesignDocPDF data={data} />);
}
