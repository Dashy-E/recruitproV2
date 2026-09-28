import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { FormData, StatutoryFormsData, EsicFamilyMemberRow } from "@/app/dashboard/employee-portal/page";

// Replica of the paper "Form-1 / Declaration Form" (ESI Corporation,
// Regulation 11/12 of the ESI (General) Regulations, 1950), including the
// instructions overleaf (page 2 of the source). The source form is
// bilingual (Hindi/English); this app has no Devanagari-capable font
// registered, so only the English half is reproduced — same information,
// same field/instruction order. Office-only entries (Employer's
// counter-signature, the "For Branch Office Use Only" box's values, Branch
// Manager sign-off) are not employee data and are left blank, same spirit
// as the other statutory forms — the box itself is still printed since it's
// part of the form's layout. No ESIC seal/logo asset exists in this app,
// so the header is text-only.
export interface Form1EsicPdfData {
  employeeCode: string;
  department: string | null;
  designation: string | null;
  recruitmentEntity: string | null;
  formData: FormData;
  statutoryData: StatutoryFormsData;
  esicFamilyMembers: EsicFamilyMemberRow[];
}

// Same 3-entity letterhead selection as Form A/B — same registered address
// for all three per the user, only the company name changes.
function getCompanyName(recruitmentEntity: string | null): string {
  if (recruitmentEntity?.includes("Primawave")) return "Primawave Software Pvt. Ltd.";
  if (recruitmentEntity?.includes("Gemini")) return "Gemini Sampling Solutions Private Limited";
  return "Mitra S. K. Private Limited";
}
const COMPANY_ADDRESS = "P-11, C. I. T. Road, Calcutta-700 014";

const B = "#000";
const MUTED = "#6b7280";

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 8, fontFamily: "Helvetica", color: B, lineHeight: 1.3 },
  formNo: { position: "absolute", top: 30, right: 30, fontSize: 8 },
  title: { fontSize: 13, fontWeight: 700, textAlign: "center", marginBottom: 6 },
  note: { fontSize: 7.5, fontStyle: "italic", color: MUTED, marginBottom: 10, textAlign: "center" },
  sectionTitle: { fontSize: 8.5, fontWeight: 700, marginBottom: 5 },
  th2: { fontSize: 8, fontWeight: 700, textDecoration: "underline", marginBottom: 6 },
  tableWrap: { borderWidth: 0.75, borderColor: B, marginBottom: 8 },
  tableHeaderRow: { flexDirection: "row", backgroundColor: "#f3f4f6" },
  tableRow: { flexDirection: "row" },
  th: { fontSize: 7, fontWeight: 700, textAlign: "center", padding: 3, borderRight: `0.75pt solid ${B}`, borderBottom: `0.75pt solid ${B}` },
  td: { fontSize: 7.5, padding: 3, minHeight: 15, borderRight: `0.75pt solid ${B}`, borderBottom: `0.75pt solid ${B}` },
  instrItem: { flexDirection: "row", marginBottom: 8 },
  instrNum: { width: 16 },
  instrText: { flex: 1, textAlign: "justify", fontSize: 8 },
});

// Solid-fill "border" (black rect + inset white rect) — never shows the
// hairline corner gap a stroked border can at high zoom (see
// application-form-pdf-document.tsx for the full explanation).
// Pass `fill` only when this box is the *shorter* one in a row pair (e.g.
// the Employer's Particulars box next to the taller Insured Person's box,
// or the photo box next to the ID-card details box): the row stretches
// both to match the taller box's height, and without `fill` the inner
// white layer stays sized to its own content, leaving the outer black
// layer exposed below it. Every other usage must leave it off, or the
// inner layer's flex:1 collapses the box (same pitfall noted in
// application-form-pdf-document.tsx for RuledFrame/Bordered there).
function Bordered({ children, fill = false, style, contentStyle }: { children: React.ReactNode; fill?: boolean; style?: Record<string, string | number>; contentStyle?: Record<string, string | number> }) {
  return (
    <View style={{ backgroundColor: B, padding: 1, marginBottom: 8, ...style }}>
      <View style={{ backgroundColor: "#fff", padding: 6, ...(fill ? { flex: 1 } : {}), ...contentStyle }}>
        {children}
      </View>
    </View>
  );
}

function Line({ n, label, value }: { n?: string; label: string; value?: string | null }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", marginBottom: 7 }}>
      <Text style={{ flexShrink: 0 }}>{n ? `${n}. ` : ""}{label}</Text>
      <Text style={{ flexGrow: 1, borderBottom: `0.75pt solid ${B}`, minHeight: 11, marginLeft: 4, paddingLeft: 2, fontWeight: 700 }}>{value || ""}</Text>
    </View>
  );
}

function formattedDate(iso: string | null | undefined): { day: string; month: string; year: string } {
  if (!iso) return { day: "", month: "", year: "" };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { day: "", month: "", year: "" };
  return { day: String(d.getDate()), month: d.toLocaleDateString("en-IN", { month: "long" }), year: String(d.getFullYear()) };
}

function Table({ headers, rows, widths }: { headers: string[]; rows: string[][]; widths?: number[] }) {
  return (
    <View style={styles.tableWrap}>
      <View style={styles.tableHeaderRow}>
        {headers.map((h, i) => (
          <Text key={i} style={[styles.th, { flex: widths?.[i] ?? 1 }, i === headers.length - 1 ? { borderRight: 0 } : {}]}>{h}</Text>
        ))}
      </View>
      {rows.length === 0 ? (
        <View style={styles.tableRow}>
          {headers.map((_, j) => (
            <Text key={j} style={[styles.td, { flex: widths?.[j] ?? 1 }, j === headers.length - 1 ? { borderRight: 0 } : {}, { borderBottom: 0 }]}> </Text>
          ))}
        </View>
      ) : (
        rows.map((r, i) => (
          <View key={i} style={styles.tableRow}>
            {r.map((c, j) => (
              <Text key={j} style={[styles.td, { flex: widths?.[j] ?? 1 }, j === r.length - 1 ? { borderRight: 0 } : {}, i === rows.length - 1 ? { borderBottom: 0 } : {}]}>{c}</Text>
            ))}
          </View>
        ))
      )}
    </View>
  );
}

function InstrItem({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <View style={styles.instrItem}>
      <Text style={styles.instrNum}>{n}.</Text>
      <Text style={styles.instrText}>{children}</Text>
    </View>
  );
}

// Page 2 of the source form — pure instructions plus the office-only "For
// Branch Office Use Only" box and a blank continuation of the family
// particulars table. None of it is employee-fillable data, so it's static.
function InstructionsPage() {
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>INSTRUCTIONS</Text>

      <InstrItem n={1}>
        Submission of Form-I is governed by regulation 11 &amp; 12 of ESI (General) Regulations, 1950.
      </InstrItem>
      <InstrItem n={2}>
        &quot;Family&quot; means all or any of the following relatives of an Insured Person namely:- (i) a spouse
        (ii) a minor legitimate or adopted child dependant upon the I.P.; (iii) a child who is wholly dependant on
        the earnings of the I.P. and who is (a) receiving education, till he or she attains the age of 21 years
        (b) an unmarried daughter; (iv) a child who is infirm by reason of any physical or mental abnormality or
        injury and is wholly dependant on the earnings of the I.P. so long as the infirmity continues; (v) dependant
        parents (Please see Section 2 clause 11 of the ESI Act 1948 for details).
      </InstrItem>
      <InstrItem n={3}>Identity Card is Non-Transferable.</InstrItem>
      <InstrItem n={4}>Loss of Identity Card be reported to Employer/Branch Manager immediately.</InstrItem>
      <InstrItem n={5}>Submission of false information attracts penal action Under Section 84 of ESI Act. 1948.</InstrItem>
      <InstrItem n={6}>
        This form duly filled in must reach the concerned Branch Office within 10 days of appointment of an
        Employee. Delay attracts penal action under Section 85 of the Act, against employer.
      </InstrItem>
      <InstrItem n={7}>
        As an insured person you and your dependant family members are entitled to full medical care. The other
        benefits in cash include (1) Sickness Benefit (2) Temporary Disablement benefit (3) Permanent disablement
        Benefit (4) Dependants benefit and (5) Maternity Benefit (in case of woman employees) subject to fulfillment
        of contributory conditions.
      </InstrItem>
      <InstrItem n={8}>
        For more details please contact website of ESIC at www.esic.org.in. or contact Regional Office or Branch
        Office.
      </InstrItem>

      <Bordered style={{ marginTop: 8 }}>
        <Text style={{ fontSize: 9.5, fontWeight: 700, textAlign: "center", marginBottom: 8 }}>For Branch Office Use only</Text>
        <Text style={{ marginBottom: 8 }}>1.&nbsp;&nbsp;Date of allotment of Ins. No. : ______________________________</Text>
        <Text style={{ marginBottom: 8 }}>2.&nbsp;&nbsp;Date of Issue of T.I.C. : ______________________________</Text>
        <Text style={{ marginBottom: 8 }}>3.&nbsp;&nbsp;Name/No. of Dispensary : ______________________________</Text>
        <Text style={{ marginBottom: 14 }}>4.&nbsp;&nbsp;Whether reciprocal Medical arrangements involved, if yes, please indicate : ______________________________</Text>
        <Text style={{ textAlign: "right", fontStyle: "italic" }}>Signature of Branch Manager</Text>
      </Bordered>

      <Text style={{ fontSize: 8, fontWeight: 700, marginTop: 10, marginBottom: 4 }}>Family Particulars (continued)</Text>
      <Table
        headers={["Sl.\nNo.", "Name", "D.O.B. / Age", "Relationship\nwith Employee", "Residing\nwith him/her", "If No, Place\nof Residence"]}
        widths={[0.4, 1.3, 1, 1, 0.9, 1.1]}
        rows={[["", "", "", "", "", ""], ["", "", "", "", "", ""], ["", "", "", "", "", ""]]}
      />
    </Page>
  );
}

export function Form1EsicPdfDocument({ data }: { data: Form1EsicPdfData }) {
  const { formData: f, statutoryData: s, esicFamilyMembers } = data;
  const name = [f.salutation, f.firstName, f.middleName, f.lastName].filter(Boolean).join(" ");
  const fatherOrHusband = [f.fatherFirstName, f.fatherLastName].filter(Boolean).join(" ");
  const dob = formattedDate(f.dateOfBirth);
  const doa = formattedDate(f.dateOfJoining);
  const companyName = getCompanyName(data.recruitmentEntity);
  const employerNameAddress = `${companyName}, ${COMPANY_ADDRESS}`;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.formNo}>Form-1</Text>
        <Text style={styles.title}>DECLARATION FORM</Text>
        <Text style={styles.note}>
          To be filled by employee after reading instructions overleaf. Two Postcard Size photographs to be
          attached with the form. This form is free of cost.
        </Text>

        <View style={{ flexDirection: "row", marginBottom: 6 }}>
          <Text style={[styles.sectionTitle, { flex: 1 }]}>(A) INSURED PERSON&apos;S PARTICULARS</Text>
          <Text style={[styles.sectionTitle, { flex: 1 }]}>(B) EMPLOYER&apos;S PARTICULARS</Text>
        </View>

        <View style={{ flexDirection: "row" }}>
          <Bordered style={{ flex: 1, marginRight: 8 }}>
            <Line n="1" label="Insurance No." value={s.insuranceNumber} />
            <Line n="2" label="Name (in block letters)" value={name} />
            <Line n="3" label="Father's/Husband's Name" value={fatherOrHusband} />
            <View style={{ flexDirection: "row", marginBottom: 7 }}>
              <Text style={{ width: 70 }}>4. D.O.B.</Text>
              <Text style={{ width: 30, borderBottom: `0.75pt solid ${B}`, marginRight: 4 }}>{dob.day}</Text>
              <Text style={{ flexGrow: 1, borderBottom: `0.75pt solid ${B}`, marginRight: 4 }}>{dob.month}</Text>
              <Text style={{ width: 36, borderBottom: `0.75pt solid ${B}` }}>{dob.year}</Text>
            </View>
            <Line n="5" label="Marital Status" value={f.maritalStatus} />
            <Line n="6" label="Sex" value={f.gender} />
            <Text style={{ marginBottom: 3 }}>7. Present Address</Text>
            <Text style={{ borderBottom: `0.75pt solid ${B}`, minHeight: 24, marginBottom: 6, paddingLeft: 2 }}>{f.presentAddress || ""}</Text>
            <Line label="Pin Code" value={f.presentPinCode} />
            <Text style={{ marginBottom: 3 }}>8. Permanent Address</Text>
            <Text style={{ borderBottom: `0.75pt solid ${B}`, minHeight: 24, marginBottom: 6, paddingLeft: 2 }}>{f.permanentAddress || ""}</Text>
            <Line label="Pin Code" value={f.permanentPinCode} />
          </Bordered>

          <Bordered fill style={{ flex: 1 }}>
            <Line n="9" label="Employer's Code No." value={s.employerCode} />
            <View style={{ flexDirection: "row", marginBottom: 7 }}>
              <Text style={{ width: 90 }}>10. Date of Appointment</Text>
              <Text style={{ width: 30, borderBottom: `0.75pt solid ${B}`, marginRight: 4 }}>{doa.day}</Text>
              <Text style={{ flexGrow: 1, borderBottom: `0.75pt solid ${B}`, marginRight: 4 }}>{doa.month}</Text>
              <Text style={{ width: 36, borderBottom: `0.75pt solid ${B}` }}>{doa.year}</Text>
            </View>
            <Text style={{ marginBottom: 3 }}>11. Name &amp; Address of the Employer</Text>
            <Text style={{ borderBottom: `0.75pt solid ${B}`, minHeight: 24, marginBottom: 8, paddingLeft: 2, fontWeight: 700 }}>{employerNameAddress}</Text>

            <Text style={{ marginBottom: 5 }}>12. In case of any previous employment, please fill up the details :</Text>
            <Line label="(a) Previous Insurance No." value={s.previousInsuranceNo} />
            <Line label="(b) Employer's Code No." value={s.previousEmployerCode} />
            <Text style={{ marginBottom: 3 }}>(c) Name &amp; Address of the Employer</Text>
            <Text style={{ borderBottom: `0.75pt solid ${B}`, minHeight: 24, paddingLeft: 2 }}>{s.previousEmployerNameAddress || ""}</Text>
          </Bordered>
        </View>

        <Text style={styles.th2}>(C) Details of Nominee u/s 71 of ESI Act 1948 for payment of cash benefit in the event of death</Text>
        <Table
          headers={["Name", "Relationship", "Address"]}
          widths={[1.2, 1, 1.6]}
          rows={f.emergencyName ? [[f.emergencyName, f.emergencyRelationship || "", ""]] : []}
        />

        <Text style={{ fontSize: 7.5, color: MUTED, marginBottom: 10, lineHeight: 1.4 }}>
          I hereby declare that the particulars given by me are correct to the best of my knowledge and belief. I
          undertake to intimate the corporation of any changes in the membership of my family within 15 days of
          such change.
        </Text>

        <Text style={styles.th2}>(D) Family Particulars of Insured Person</Text>
        <Table
          headers={["Sl.\nNo.", "Name", "D.O.B. / Age", "Relationship\nwith Employee", "Residing\nwith him/her", "If No, Place\nof Residence"]}
          widths={[0.4, 1.3, 1, 1, 0.9, 1.1]}
          rows={esicFamilyMembers.filter((m) => m.name).map((m, i) => [String(i + 1), m.name, m.dob, m.relationship, m.residingWithEmployee, m.placeOfResidence])}
        />

        <Text style={styles.th2}>ESI Corporation Temporary Identity Card (Valid for 3 months from the date of appointment)</Text>
        <View style={{ flexDirection: "row" }}>
          <Bordered style={{ flex: 1, marginRight: 8 }}>
            <Line label="Name" value={name} />
            <Line label="Ins. No." value={s.insuranceNumber} />
            <Line label="Date of Appointment" value={f.dateOfJoining} />
            <Text style={{ marginBottom: 3 }}>Employer's Code No. &amp; Address</Text>
            <Text style={{ borderBottom: `0.75pt solid ${B}`, minHeight: 20, paddingLeft: 2 }}>{employerNameAddress}</Text>
          </Bordered>
          <Bordered fill style={{ width: 110 }} contentStyle={{ alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 7.5, color: MUTED, textAlign: "center" }}>Space for photograph</Text>
          </Bordered>
        </View>

        <View style={{ flexDirection: "row", marginTop: 8 }}>
          <Text style={{ flex: 1 }}>Dated: ______________</Text>
          <Text style={{ flex: 1 }}>Signature/T.I. of I.P.: ______________</Text>
        </View>
      </Page>
      <InstructionsPage />
    </Document>
  );
}
