import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

// PLACEHOLDER layout — the real offer letter format/letterhead will be
// supplied later and should replace the body of this component; the
// MRFPdfData component (mrf-pdf-document.tsx) shows the established pattern
// for a real letterheaded, per-entity PDF once that format is available.
export interface OfferLetterPdfData {
  firstName: string;
  lastName: string;
  designation: string | null;
  grade: string | null;
  location: string | null;
  dateOfJoining: string | null;
  address: string | null;
}

const INK = "#1f2937";
const MUTED = "#6b7280";
const RULE = "#9ca3af";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: INK },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 9, color: MUTED, marginBottom: 20 },
  row: { flexDirection: "row", marginBottom: 8, borderBottom: `0.75pt solid ${RULE}`, paddingBottom: 4 },
  label: { width: 140, color: MUTED },
  value: { flex: 1, fontWeight: 600 },
});

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value || "—"}</Text>
    </View>
  );
}

export function OfferLetterPdfDocument({ candidate }: { candidate: OfferLetterPdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Offer Letter (Placeholder)</Text>
        <Text style={styles.subtitle}>
          This is a placeholder layout — replace with the actual offer letter format once supplied.
        </Text>
        <Field label="Candidate Name" value={`${candidate.firstName} ${candidate.lastName}`} />
        <Field label="Designation" value={candidate.designation} />
        <Field label="Grade" value={candidate.grade} />
        <Field label="Location" value={candidate.location} />
        <Field label="Date of Joining" value={candidate.dateOfJoining ? candidate.dateOfJoining.slice(0, 10) : null} />
        <Field label="Address" value={candidate.address} />
      </Page>
    </Document>
  );
}
