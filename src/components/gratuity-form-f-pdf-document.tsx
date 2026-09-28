import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { FormData, StatutoryFormsData, GratuityNomineeRow } from "@/app/dashboard/employee-portal/page";

// Verbatim replica of "GRATUITY FORM - F 2.pdf" (Payment of Gratuity Act,
// 1972, Form 'F' Nomination, See sub-rule (1) of Rule 6). Witness
// declaration, employer certificate and the employee's own
// signature/acknowledgment blocks on page 2 are not employee-fillable data
// (they're signed later, by other parties or in person) and are printed
// blank, same spirit as the other statutory forms. The address breakdown in
// item 8 (Village/Thana/Post Office/District/State) reuses the same
// permanent-address fields collected for PF Form B, since they're the same
// underlying address, not form-specific data — "Sub Division" has no
// corresponding input anywhere in this app and is left blank.
export interface GratuityFormFPdfData {
  employeeCode: string;
  department: string | null;
  designation: string | null;
  recruitmentEntity: string | null;
  formData: FormData;
  statutoryData: StatutoryFormsData;
  gratuityNominees: GratuityNomineeRow[];
}

// Same 3-entity letterhead selection as the other statutory forms — same
// registered address for all three per the user, only the company name
// changes.
function getCompanyName(recruitmentEntity: string | null): string {
  if (recruitmentEntity?.includes("Primawave")) return "Primawave Software Pvt. Ltd.";
  if (recruitmentEntity?.includes("Gemini")) return "Gemini Sampling Solutions Private Limited";
  return "Mitra S. K. Private Limited";
}
const COMPANY_ADDRESS = "P-11, C. I. T. Road, Calcutta-700 014";

const B = "#000";
const MUTED = "#6b7280";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: "Helvetica", color: B, lineHeight: 1.35 },
  formBadgeOuter: { alignItems: "center", marginBottom: 10 },
  formBadge: { borderWidth: 1.3, borderColor: B, paddingVertical: 4, paddingHorizontal: 16 },
  formBadgeText: { fontSize: 17, fontWeight: 700 },
  title: { fontSize: 11.5, fontWeight: 700, textAlign: "center" },
  subtitle: { fontSize: 9.5, fontWeight: 700, textAlign: "center", marginBottom: 10 },
  numPara: { flexDirection: "row", marginBottom: 9 },
  numCol: { width: 16 },
  numText: { flex: 1, textAlign: "justify" },
  tableWrap: { borderWidth: 1, borderColor: B, marginTop: 4 },
  tableHeaderRow: { flexDirection: "row", backgroundColor: "#f3f4f6" },
  tableRow: { flexDirection: "row" },
  th: { fontSize: 7.5, fontWeight: 700, textAlign: "center", padding: 4, borderRight: `0.75pt solid ${B}`, borderBottom: `0.75pt solid ${B}` },
  td: { fontSize: 8, padding: 4, minHeight: 26, borderRight: `0.75pt solid ${B}`, borderBottom: `0.75pt solid ${B}` },
  stLine: { flexDirection: "row", alignItems: "flex-end", marginBottom: 8 },
  stNum: { width: 16 },
});

function NumPara({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <View style={styles.numPara}>
      <Text style={styles.numCol}>{n}.</Text>
      <Text style={styles.numText}>{children}</Text>
    </View>
  );
}

// Numbered "8. Label ___value___" statement line — root has no flex, so
// it's safe to stack several inside a column without the flex-in-column
// pitfall (see application-form-pdf-document.tsx for the full note).
function StLine({ n, label, value }: { n?: string; label: string; value?: string | null }) {
  return (
    <View style={styles.stLine}>
      {n !== undefined && <Text style={styles.stNum}>{n}.</Text>}
      <Text>{label}</Text>
      <Text style={{ flexGrow: 1, borderBottom: `0.5pt solid ${B}`, minHeight: 11, marginLeft: 4, paddingLeft: 2, fontWeight: 700 }}>{value || ""}</Text>
    </View>
  );
}

function Table({ headers, rows, widths }: { headers: string[]; rows: string[][]; widths?: number[] }) {
  return (
    <View style={styles.tableWrap}>
      <View style={styles.tableHeaderRow}>
        {headers.map((h, i) => (
          <Text key={i} style={[styles.th, { flex: widths?.[i] ?? 1 }, i === headers.length - 1 ? { borderRight: 0 } : {}]}>{h}</Text>
        ))}
      </View>
      {(rows.length === 0 ? [["", "", "", ""], ["", "", "", ""]] : rows).map((r, i, arr) => (
        <View key={i} style={styles.tableRow}>
          {r.map((c, j) => (
            <Text key={j} style={[styles.td, { flex: widths?.[j] ?? 1 }, j === r.length - 1 ? { borderRight: 0 } : {}, i === arr.length - 1 ? { borderBottom: 0 } : {}]}>{c}</Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function StatementPage({ data }: { data: GratuityFormFPdfData }) {
  const { formData: f, statutoryData: s } = data;
  const name = [f.salutation, f.firstName, f.middleName, f.lastName].filter(Boolean).join(" ");
  const addressLine = [s.pfNomineeVillage, s.pfNomineeThana, s.pfNomineePostOffice, s.pfNomineeDistrict, s.pfNomineeState].filter(Boolean).join(", ");

  return (
    <Page size="A4" style={styles.page}>
      <Text style={{ fontSize: 12, fontWeight: 700, textAlign: "center", marginBottom: 16 }}>STATEMENT</Text>

      <StLine n="1" label="Name of the employee in full" value={name} />
      <StLine n="2" label="Sex" value={f.gender} />
      <StLine n="3" label="Religion" value={f.religion} />
      <StLine n="4" label="Whether unmarried/married/widow/widower" value={f.maritalStatus} />
      <StLine n="5" label="Department Branch/Section where employed" value={data.department} />
      <StLine n="6" label="Post held with Ticket No. Serial No. if any" value={[data.designation, data.employeeCode].filter(Boolean).join(" / ")} />
      <StLine n="7" label="Date of appointment" value={f.dateOfJoining} />
      <StLine n="8" label="Permanent address" value={f.permanentAddress} />
      <View style={{ flexDirection: "row", marginBottom: 8, marginLeft: 20 }}>
        <Text style={{ flex: 1, borderBottom: `0.5pt solid ${B}`, paddingLeft: 2 }}>Village: {s.pfNomineeVillage || ""}</Text>
        <Text style={{ flex: 1, borderBottom: `0.5pt solid ${B}`, marginLeft: 6, paddingLeft: 2 }}>Thana: {s.pfNomineeThana || ""}</Text>
        <Text style={{ flex: 1, borderBottom: `0.5pt solid ${B}`, marginLeft: 6, paddingLeft: 2 }}>Sub Division:</Text>
      </View>
      <View style={{ flexDirection: "row", marginBottom: 14, marginLeft: 20 }}>
        <Text style={{ flex: 1, borderBottom: `0.5pt solid ${B}`, paddingLeft: 2 }}>Post Office: {s.pfNomineePostOffice || ""}</Text>
        <Text style={{ flex: 1, borderBottom: `0.5pt solid ${B}`, marginLeft: 6, paddingLeft: 2 }}>District: {s.pfNomineeDistrict || ""}</Text>
        <Text style={{ flex: 1, borderBottom: `0.5pt solid ${B}`, marginLeft: 6, paddingLeft: 2 }}>State: {s.pfNomineeState || ""}</Text>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderColor: B, paddingBottom: 20, marginBottom: 20 }}>
        <Text>Place-</Text>
        <Text style={{ fontStyle: "italic" }}>Signature/Thumb Impression{"\n"}of the employee</Text>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 20 }}>
        <Text>Date: {s.gratuityDate || ""}</Text>
      </View>

      <Text style={{ fontSize: 10.5, fontWeight: 700, textAlign: "center", marginBottom: 8 }}>Declaration by witnesses</Text>
      <Text style={{ marginBottom: 4 }}>Nomination signed/Thumb impressed before me</Text>
      <Text style={{ marginBottom: 20 }}>Name in full and full address of witnesses</Text>
      <View style={{ flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderColor: B, paddingBottom: 14, marginBottom: 6 }}>
        <Text>Place:</Text>
        <Text style={{ fontStyle: "italic" }}>signature of witnesses</Text>
      </View>
      <Text style={{ marginBottom: 20 }}>Date:</Text>

      <Text style={{ fontSize: 10.5, fontWeight: 700, textAlign: "center", marginBottom: 8 }}>Certificate by the employer</Text>
      <Text style={{ marginBottom: 14 }}>
        Certified that the particulars of the above nomination have been verified and recorded in this establishment
      </Text>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 20 }}>
        <Text>Employer&apos;s reference No, if any</Text>
        <View style={{ alignItems: "flex-end" }}>
          <Text>Signature of the employer/Officer authorized</Text>
          <Text>Designation</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderColor: B, paddingBottom: 14, marginBottom: 6 }}>
        <Text>Date:</Text>
        <View style={{ alignItems: "flex-end" }}>
          <Text>Name address of the establishment</Text>
          <Text>or rubber stamp thereof</Text>
        </View>
      </View>

      <Text style={{ fontSize: 10.5, fontWeight: 700, textAlign: "center", marginTop: 8, marginBottom: 8 }}>Acknowledgment by the employee</Text>
      <Text style={{ marginBottom: 14 }}>
        Received the duplicate of the nomination in Form &apos;F&apos; filled by me and duly certified by the employer.
      </Text>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text>Date:</Text>
        <Text style={{ fontStyle: "italic" }}>Signature of the employee</Text>
      </View>
      <Text style={{ fontSize: 7.5, color: MUTED, marginTop: 6 }}>Note: Strike out words/paragraph not applicable</Text>
    </Page>
  );
}

export function GratuityFormFPdfDocument({ data }: { data: GratuityFormFPdfData }) {
  const { formData: f, gratuityNominees } = data;
  const name = [f.salutation, f.firstName, f.middleName, f.lastName].filter(Boolean).join(" ");
  const companyName = getCompanyName(data.recruitmentEntity);
  const filledNominees = gratuityNominees.filter((n) => n.name);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.formBadgeOuter}>
          <View style={styles.formBadge}>
            <Text style={styles.formBadgeText}>FORM &ndash;&apos;F&apos;</Text>
          </View>
        </View>
        <Text style={styles.title}>PAYMENT OF GRATUITY ACT.</Text>
        <Text style={styles.title}>[ SEE SUB-RULE (1) of Rule 6 ]</Text>
        <Text style={styles.subtitle}>NOMINATION</Text>

        <Text style={{ marginBottom: 2 }}>To,</Text>
        <Text style={{ fontWeight: 700, marginBottom: 2 }}>{companyName}</Text>
        <Text style={{ fontWeight: 700, marginBottom: 8 }}>{COMPANY_ADDRESS}</Text>
        <Text style={{ fontSize: 8, color: MUTED, marginBottom: 14 }}>[ I Give here name or description of the establishment with full address ]</Text>

        <View style={{ flexDirection: "row", alignItems: "flex-end", marginBottom: 2 }}>
          <Text style={styles.stNum}>1.</Text>
          <Text>Shri/Shrimati</Text>
          <Text style={{ flexGrow: 1, borderBottom: `0.5pt solid ${B}`, marginLeft: 4, paddingLeft: 2, fontWeight: 700 }}>{name}</Text>
        </View>
        <Text style={{ fontSize: 7.5, color: MUTED, textAlign: "center", marginBottom: 10 }}>[Name in full here]</Text>

        <Text style={{ marginBottom: 14 }}>
          Whose particulars are given in the statement below. I hereby nominate the person(s) mentioned below to
          receive the gratuity payable after my death as also the gratuity standing to my credit in the event of my
          death before the amount has become payable or having become payable has not been paid and direct that the
          said amount of gratuity shall be paid in proportion indicated against the name(s) of the nominee(s).
        </Text>

        <NumPara n={2}>
          I hereby certify the person(s) mentioned is/are a member(s) of my family within the meaning of clause (h)
          of Section (2) of the Payment of Gratuity Act, 1972.
        </NumPara>
        <NumPara n={3}>
          I hereby declare that I have no family within the meaning of clause (h) of section (2) of the said Act.
        </NumPara>
        <View style={styles.numPara}>
          <Text style={styles.numCol}>4.</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ marginBottom: 4 }}>(a) My Father/Mother/Parents is/are not dependent on me.</Text>
            <Text>(b) My husband&apos;s/father/mother/parents is/are not dependent on my husband.</Text>
          </View>
        </View>
        <NumPara n={5}>
          I have excluded My Husband from my family by a notice dated the ………. to the controlling authority in
          terms of the provision to clause (h) of section 2 of the said Act.
        </NumPara>
        <NumPara n={6}>Nomination made herein invalidates my previous nomination.</NumPara>

        <Text style={{ fontSize: 10.5, fontWeight: 700, textAlign: "center", marginTop: 4, marginBottom: 4 }}>NOMINEE&apos;S</Text>
        <Table
          headers={["Name in full with full\naddress of nominee(s)\n(1)", "Relationship with\nthe employee\n(2)", "Age of\nnominee\n(3)", "Proportion by which the\ngratuity will be shared\n(4)"]}
          widths={[1.6, 1, 0.7, 1.2]}
          rows={filledNominees.map((n) => [[n.name, n.address].filter(Boolean).join(", "), n.relationship, n.age, n.proportion])}
        />
      </Page>
      <StatementPage data={data} />
    </Document>
  );
}
