import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { FormData, StatutoryFormsData, PfNomineeRow } from "@/app/dashboard/employee-portal/page";

// Verbatim replica of the paper 'Form "B"' (Staff Provident Fund nomination)
// — a plain letter with underlined blank-line fields and one table, not a
// boxed form, matching the source. Witness signatures and the "Signature of
// In-charge" block are office/third-party-only and left blank, same spirit
// as the other statutory forms.
export interface FormBPdfData {
  employeeCode: string;
  department: string | null;
  designation: string | null;
  recruitmentEntity: string | null;
  formData: FormData;
  statutoryData: StatutoryFormsData;
  pfNominees: PfNomineeRow[];
}

// Same 3-entity letterhead selection as Form A (form-a-pdf-document.tsx).
function getCompanyName(recruitmentEntity: string | null): string {
  if (recruitmentEntity?.includes("Primawave")) return "Primawave Software Pvt. Ltd.";
  if (recruitmentEntity?.includes("Gemini")) return "Gemini Sampling Solutions Private Limited";
  return "Mitra S. K. Private Ltd.";
}

const INK = "#000";
const RULE = "#000";

const styles = StyleSheet.create({
  page: { padding: 44, paddingTop: 36, fontSize: 9.5, fontFamily: "Helvetica", color: INK, lineHeight: 1.35 },
  title: { fontSize: 13, fontWeight: 700, textAlign: "center", marginBottom: 6 },
  subtitle: { fontSize: 12, fontWeight: 700, textAlign: "center", marginBottom: 16 },
  itemRow: { flexDirection: "row", marginBottom: 9 },
  itemNum: { width: 16 },
  itemBody: { flex: 1 },
  para: { marginBottom: 9, textAlign: "justify" },
  tableWrap: { borderWidth: 1, borderColor: RULE, marginBottom: 12, marginTop: 6 },
  tableHeaderRow: { flexDirection: "row", backgroundColor: "#f3f4f6" },
  tableRow: { flexDirection: "row" },
  th: { fontSize: 7.5, fontWeight: 700, textAlign: "center", padding: 4, borderRight: `0.75pt solid ${RULE}`, borderBottom: `0.75pt solid ${RULE}` },
  td: { fontSize: 8.5, padding: 4, minHeight: 22, borderRight: `0.75pt solid ${RULE}`, borderBottom: `0.75pt solid ${RULE}` },
});

function Blank({ label, value, flex = 1, width }: { label: string; value?: string | null; flex?: number; width?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", flex: width ? undefined : flex, marginRight: 10 }}>
      {!!label && <Text>{label}</Text>}
      <Text
        style={
          width
            ? { width, borderBottom: `0.75pt solid ${RULE}`, minHeight: 12, marginLeft: 4, paddingLeft: 2, fontWeight: 700 }
            : { flexGrow: 1, borderBottom: `0.75pt solid ${RULE}`, minHeight: 12, marginLeft: 4, paddingLeft: 2, fontWeight: 700 }
        }
      >
        {value || ""}
      </Text>
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
      {rows.map((r, i) => (
        <View key={i} style={styles.tableRow}>
          {r.map((c, j) => (
            <Text key={j} style={[styles.td, { flex: widths?.[j] ?? 1 }, j === r.length - 1 ? { borderRight: 0 } : {}, i === rows.length - 1 ? { borderBottom: 0 } : {}]}>{c}</Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function formattedDate(iso: string | null | undefined): { day: string; month: string; year: string } {
  if (!iso) return { day: "", month: "", year: "" };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { day: "", month: "", year: "" };
  return { day: String(d.getDate()), month: d.toLocaleDateString("en-IN", { month: "long" }), year: String(d.getFullYear()) };
}

export function FormBPdfDocument({ data }: { data: FormBPdfData }) {
  const { formData: f, statutoryData: s, pfNominees } = data;
  const givenName = [f.firstName, f.middleName].filter(Boolean).join(" ");
  const dob = formattedDate(f.dateOfBirth);
  const dated = formattedDate(s.formBDate);
  const companyName = getCompanyName(data.recruitmentEntity);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>FORM &quot;B&quot;</Text>
        <Text style={styles.subtitle}>{companyName}, Staff Provident Fund</Text>

        <View style={styles.itemRow}>
          <Text style={styles.itemNum}>1.</Text>
          <View style={styles.itemBody}>
            <View style={{ flexDirection: "row" }}>
              <Blank label="Name of employee" value={givenName} flex={2} />
              <Blank label="Surname" value={f.lastName} flex={1} />
            </View>
            <Text style={{ fontSize: 7.5, color: "#6b7280", marginTop: 2 }}>( in block capitals )</Text>
          </View>
        </View>

        <View style={styles.itemRow}>
          <Text style={styles.itemNum}>2.</Text>
          <View style={[styles.itemBody, { flexDirection: "row" }]}>
            <Blank label="Sex" value={f.gender} flex={1} />
            <View style={{ flexDirection: "row", flex: 1 }}>
              <Text style={{ width: 16 }}>3.</Text>
              <Blank label="Religion" value={f.religion} flex={1} />
            </View>
          </View>
        </View>

        <View style={styles.itemRow}>
          <Text style={styles.itemNum}>4.</Text>
          <Blank label="Father's name" value={[f.fatherFirstName, f.fatherLastName].filter(Boolean).join(" ")} />
        </View>

        <View style={styles.itemRow}>
          <Text style={styles.itemNum}>5.</Text>
          <Blank label="Husband's name" value={s.husbandName} />
        </View>

        <View style={styles.itemRow}>
          <Text style={styles.itemNum}>6.</Text>
          <Blank label="Marital Status" value={f.maritalStatus} />
        </View>

        <View style={styles.itemRow}>
          <Text style={styles.itemNum}>7.</Text>
          <View style={[styles.itemBody, { flexDirection: "row" }]}>
            <Text style={{ marginRight: 4 }}>Date of birth</Text>
            <Blank label="Day" value={dob.day} width={40} />
            <Blank label="Month" value={dob.month} width={80} />
            <Blank label="Year" value={dob.year} width={50} />
          </View>
        </View>

        <View style={styles.itemRow}>
          <Text style={styles.itemNum}>8.</Text>
          <View style={styles.itemBody}>
            <Text style={{ marginBottom: 6 }}>Permanent Address :</Text>
            <View style={{ flexDirection: "row", marginBottom: 9 }}>
              <Blank label="Village" value={s.pfNomineeVillage} flex={1} />
              <Blank label="Thana" value={s.pfNomineeThana} flex={1} />
            </View>
            <View style={{ flexDirection: "row", marginBottom: 9 }}>
              <Blank label="P. O." value={s.pfNomineePostOffice} flex={1} />
              <Blank label="District" value={s.pfNomineeDistrict} flex={1} />
            </View>
            <View style={{ flexDirection: "row" }}>
              <Blank label="State" value={s.pfNomineeState} flex={1} />
            </View>
          </View>
        </View>

        <Text style={styles.para}>
          * (i)&nbsp;&nbsp;Certified that I have no family and should I acquire family hereafter, the above nomination
          should be deemed cancelled.
        </Text>
        <Text style={styles.para}>
          *(ii)&nbsp;&nbsp;Certified that my father/mother/sister(s)/minor brother(s) is/are dependent upon me.
        </Text>
        <Text style={styles.para}>
          I hereby nominate the person(s) mentioned below to receive the amount that may stand to my
          credit in the provident fund in the event of my death before that amount becomes payable or
          having become payable has not been paid, and direct that the said amount shall be distributed
          among the said person in the manner shown against their name :
        </Text>

        <Table
          headers={["Name & Address of nominee or nominees.", "Nominee's relationship with employee", "Age of Nominee", "Amount or share of accumulation in the P.F. to be paid to each nominee"]}
          widths={[1.6, 1.1, 0.8, 1.3]}
          rows={pfNominees.map((n) => [[n.name, n.address].filter(Boolean).join(", "), n.relationship, n.age, n.share])}
        />

        <View style={{ flexDirection: "row", alignItems: "flex-end", marginBottom: 20 }}>
          <Text>Dated this</Text>
          <Blank label="" value={dated.day} width={40} />
          <Text style={{ marginLeft: 6 }}>Day of</Text>
          <Blank label="" value={dated.month} width={70} />
          <Blank label="" value={dated.year} width={50} />
          <Text style={{ marginLeft: 6 }}>at</Text>
          <Blank label="" value="" flex={1} />
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 14 }}>
          <Text>Two Witness to Signature</Text>
          <Text>Signature of Employee</Text>
        </View>
        <Text style={{ marginBottom: 8 }}>1.</Text>
        <Text style={{ marginBottom: 14 }}>2.</Text>

        <View style={{ flexDirection: "row", alignItems: "flex-end", marginBottom: 4 }}>
          <Text>Certified that the above declaration has been signed by Sri/Srimati</Text>
          <Text style={{ flexGrow: 1, borderBottom: `0.75pt solid ${RULE}`, minHeight: 12, marginLeft: 4, paddingLeft: 2, fontWeight: 700 }}>
            {[f.salutation, f.firstName, f.middleName, f.lastName].filter(Boolean).join(" ")}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "flex-end", marginBottom: 16 }}>
          <Text style={{ flexGrow: 1, borderBottom: `0.75pt solid ${RULE}`, minHeight: 12 }} />
          <Text style={{ marginLeft: 6, marginRight: 4 }}>before me after</Text>
          <View>
            <Text>*he/she read the entries</Text>
            <Text>*the entries have been read over to him/her by me</Text>
          </View>
        </View>

        <Text style={{ fontSize: 8.5, marginBottom: 20 }}>*&nbsp;&nbsp;Delete in-applicable words.</Text>

        <Text style={{ fontStyle: "italic", textAlign: "right" }}>Signature of In-charge.</Text>
      </Page>
    </Document>
  );
}
