import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { FormData, AppFormData, StatutoryFormsData } from "@/app/dashboard/employee-portal/page";

export interface BankDetailsPdfData {
  employeeCode: string;
  department: string | null;
  designation: string | null;
  formData: FormData;
  appFormData: AppFormData;
  statutoryData: StatutoryFormsData;
}

const INK = "#1f2937";
const MUTED = "#6b7280";
const RULE = "#9ca3af";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 9.5, fontFamily: "Helvetica", color: INK },
  title: { fontSize: 14, fontWeight: 700, textAlign: "center", marginBottom: 4 },
  subtitle: { fontSize: 9, textAlign: "center", color: MUTED, marginBottom: 20 },
  sectionHeader: {
    fontSize: 9, fontWeight: 700, color: INK, backgroundColor: "#e5e7eb",
    paddingVertical: 3, paddingHorizontal: 6, marginTop: 10, marginBottom: 8,
  },
  row: { flexDirection: "row", marginBottom: 8, alignItems: "flex-end" },
  field: { flexDirection: "row", flex: 1, alignItems: "flex-end" },
  label: { marginRight: 4, color: MUTED },
  value: { flex: 1, borderBottom: `0.75pt solid ${RULE}`, paddingBottom: 2, minHeight: 13, color: "#111827", fontWeight: 600 },
});

function Field({ label, value, flex = 1 }: { label: string; value: string | null | undefined; flex?: number }) {
  return (
    <View style={[styles.field, { flex }]}>
      <Text style={styles.label}>{label}:</Text>
      <Text style={styles.value}>{value || ""}</Text>
    </View>
  );
}

export function BankDetailsPdfDocument({ data }: { data: BankDetailsPdfData }) {
  const { formData: f, appFormData: af, statutoryData: s } = data;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>BANK DETAILS FORM</Text>
        <Text style={styles.subtitle}>For salary credit / payroll processing</Text>

        <Text style={styles.sectionHeader}>EMPLOYEE DETAILS</Text>
        <View style={styles.row}>
          <Field label="Name" value={[f.firstName, f.middleName, f.lastName].filter(Boolean).join(" ")} flex={2} />
          <Field label="Employee Code" value={data.employeeCode} />
        </View>
        <View style={styles.row}>
          <Field label="Department" value={data.department} />
          <Field label="Designation" value={data.designation} />
        </View>

        <Text style={styles.sectionHeader}>BANK ACCOUNT DETAILS</Text>
        <View style={styles.row}>
          <Field label="Bank Name" value={f.bankName} flex={2} />
          <Field label="Account Type" value={s.bankAccountType} />
        </View>
        <View style={styles.row}>
          <Field label="Branch Name" value={f.bankBranchName} flex={2} />
        </View>
        <View style={styles.row}>
          <Field label="Branch Address" value={af.bankBranchAddress} />
        </View>
        <View style={styles.row}>
          <Field label="Account Number" value={f.bankAccountNumber} flex={2} />
        </View>
        <View style={styles.row}>
          <Field label="IFSC Code" value={f.ifscCode} />
          <Field label="MICR Code" value={af.micrCode} />
        </View>
        <View style={styles.row}>
          <Field label="Name as per Bank Records" value={f.employeeNameAsPerBank} flex={2} />
        </View>

        <Text style={{ fontSize: 8, color: MUTED, marginTop: 6 }}>
          Note: Please attach a photocopy of the passbook front page or a cancelled cheque leaf.
        </Text>

        <View style={{ marginTop: 40, flexDirection: "row", justifyContent: "space-between" }}>
          <Field label="Date" value="" flex={1} />
          <View style={{ width: 20 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.value, { borderBottom: `0.75pt solid ${RULE}`, minHeight: 13 }]}> </Text>
            <Text style={{ fontSize: 8, color: MUTED, marginTop: 2 }}>Employee Signature</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
