import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { FormData, StatutoryFormsData } from "@/app/dashboard/employee-portal/page";

// Verbatim replica of the paper "Form A" (Provident Fund Rules declaration)
// — a plain letter with underlined blank-line fields, not a boxed form,
// matching the source. "Verified" is an office-only sign-off, left blank;
// the signature is left blank too (no drawing/signature-capture capability
// in this app), same spirit as the other statutory forms.
export interface FormAPdfData {
  employeeCode: string;
  department: string | null;
  designation: string | null;
  recruitmentEntity: string | null;
  formData: FormData;
  statutoryData: StatutoryFormsData;
}

// Same 3-entity letterhead selection as the other statutory forms
// (application-form-pdf-document.tsx / mrf-pdf-document.tsx) — the company
// name changes with the candidate's recruitmentEntity, same registered
// address for all three (per the user, until entity-specific addresses are
// supplied).
function getCompanyName(recruitmentEntity: string | null): string {
  if (recruitmentEntity?.includes("Primawave")) return "Primawave Software Pvt. Ltd.";
  if (recruitmentEntity?.includes("Gemini")) return "Gemini Sampling Solutions Private Limited";
  return "Mitra S. K. Private Limited";
}

const INK = "#000";
const RULE = "#000";

const styles = StyleSheet.create({
  page: { padding: 48, paddingTop: 40, fontSize: 10.5, fontFamily: "Helvetica", color: INK, lineHeight: 1.4 },
  title: { fontSize: 15, fontWeight: 700, textAlign: "center", letterSpacing: 2, marginBottom: 24 },
  para: { marginBottom: 22, textAlign: "justify" },
});

function Line({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", marginBottom: 16 }}>
      <Text>{label}</Text>
      <Text style={{ flexGrow: 1, borderBottom: `0.75pt solid ${RULE}`, minHeight: 13, marginLeft: 4, paddingLeft: 2 }}>{value || ""}</Text>
    </View>
  );
}

function formattedDate(iso: string | null | undefined): { day: string; month: string; year: string } {
  if (!iso) return { day: "", month: "", year: "" };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { day: "", month: "", year: "" };
  return {
    day: String(d.getDate()),
    month: d.toLocaleDateString("en-IN", { month: "long" }),
    year: String(d.getFullYear()),
  };
}

export function FormAPdfDocument({ data }: { data: FormAPdfData }) {
  const { formData: f, statutoryData: s } = data;
  const name = [f.salutation, f.firstName, f.middleName, f.lastName].filter(Boolean).join(" ");
  const dob = formattedDate(f.dateOfBirth);
  const declDate = formattedDate(s.formADate);
  const companyName = getCompanyName(data.recruitmentEntity);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>FORM A</Text>

        <Text style={styles.para}>
          I hereby declare that I have read and understood the Rules of the Provident
          Fund of {companyName} and I agree to subscribe to and become a
          member of that Provident Fund and to be bound by the said Rules :
        </Text>

        <View style={{ flexDirection: "row", alignItems: "flex-end", marginBottom: 16 }}>
          <Text>Date</Text>
          <Text style={{ width: 60, borderBottom: `0.75pt solid ${RULE}`, marginLeft: 4, marginRight: 4 }}>{declDate.day}</Text>
          <Text>day of</Text>
          <Text style={{ flexGrow: 1, borderBottom: `0.75pt solid ${RULE}`, marginLeft: 4, marginRight: 4 }}>{declDate.month}</Text>
          <Text style={{ width: 50, borderBottom: `0.75pt solid ${RULE}` }}>{declDate.year}</Text>
        </View>

        <Line label="Name in full" value={name} />
        <Line label="Address" value={f.presentAddress} />
        <Line label="Date of Birth" value={f.dateOfBirth ? `${dob.day} ${dob.month} ${dob.year}` : ""} />
        <Line label="Designation" value={data.designation} />
        <Line label="Nature of Appointment" value={s.natureOfAppointment} />
        <Line label="Date of Joining Service" value={f.dateOfJoining} />
        <Line label="Salary per mensem Rs." value={s.salaryPerMensem} />
        <Line label="Verified" value="" />

        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 30 }}>
          <View>
            <Text style={{ fontWeight: 700 }}>For {companyName}</Text>
            <Text>P-11, C. I. T. Road,</Text>
            <Text>Calcutta-700 014</Text>
          </View>
          <Text style={{ fontStyle: "italic", alignSelf: "flex-end" }}>Signature of employee.</Text>
        </View>
      </Page>
    </Document>
  );
}
