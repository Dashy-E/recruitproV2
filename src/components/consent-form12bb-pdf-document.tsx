import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { FormData, StatutoryFormsData, Chapter6ADeductionRow } from "@/app/dashboard/employee-portal/page";

// Verbatim replica of "Consent and Form-12BB" — a plain Consent & Self
// Declaration letter (page 1) followed by the official Form No. 12BB tax
// declaration table (page 2, See rule 26C). The letterhead company/address
// on page 1 follows the same recruitmentEntity switch as the other
// statutory forms, but keeps THIS letter's own printed address (a different
// office than the P-11 C.I.T. Road one used on Form A/B/ESIC) for all three
// entities, per the source. The Chapter VI-A sub-item placeholders
// ((a)-(g) blank dotted lines under Section 80C, etc.) have no
// corresponding input in this app, so that section is rendered from the
// `chapter6ADeductions` list the employee actually filled in instead of
// reproducing empty dotted placeholders. The employer's own verification
// fields (Company Name/Branch on the Form 12BB footer) mirror the
// employee's declared department, since there's no separate input for them.
export interface ConsentForm12BBPdfData {
  employeeCode: string;
  department: string | null;
  designation: string | null;
  recruitmentEntity: string | null;
  formData: FormData;
  statutoryData: StatutoryFormsData;
  chapter6ADeductions: Chapter6ADeductionRow[];
}

// Same 3-entity letterhead selection as Form A/B/ESIC — same registered
// address for all three per the user, only the company name changes.
function getCompanyName(recruitmentEntity: string | null): string {
  if (recruitmentEntity?.includes("Primawave")) return "Primawave Software Pvt. Ltd.";
  if (recruitmentEntity?.includes("Gemini")) return "Gemini Sampling Solutions Private Limited";
  return "Mitra S. K. Private Limited";
}
const LETTER_ADDRESS = ["74B, AJC Bose Road, Shrachi Centre", "5th Floor, Kolkata-700016"];

const B = "#000";
const MUTED = "#6b7280";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: "Helvetica", color: B, lineHeight: 1.35 },
  letterTitle: { fontSize: 10.5, fontWeight: 700, textAlign: "center", marginBottom: 26 },
  para: { marginBottom: 10, textAlign: "justify" },
  formTitle: { fontSize: 11.5, fontWeight: 700, textAlign: "center" },
  formSubtitle: { fontSize: 8.5, textAlign: "center", marginBottom: 8 },
  gridWrap: { borderWidth: 1, borderColor: B },
  gridLine: { flexDirection: "row", borderBottomWidth: 1, borderColor: B, padding: 3 },
  claimHeaderRow: { flexDirection: "row", borderBottomWidth: 1, borderColor: B, backgroundColor: "#f3f4f6" },
  claimRow: { flexDirection: "row", borderBottomWidth: 1, borderColor: B },
  slCol: { width: 22, padding: 3, borderRightWidth: 1, borderColor: B },
  natureCol: { flex: 2.3, padding: 3, borderRightWidth: 1, borderColor: B },
  amountCol: { flex: 0.9, padding: 3, borderRightWidth: 1, borderColor: B },
  evidenceCol: { flex: 1.4, padding: 3 },
  claimHeaderText: { fontSize: 7.5, fontWeight: 700, textAlign: "center" },
});

function GridLine({ label, value, bold = true }: { label: string; value?: string | null; bold?: boolean }) {
  return (
    <View style={styles.gridLine}>
      <Text>{label}</Text>
      <Text style={{ flexGrow: 1, marginLeft: 4, fontWeight: bold ? 700 : 400 }}>{value || ""}</Text>
    </View>
  );
}

function formattedDate(iso: string | null | undefined): { day: string; month: string; year: string } {
  if (!iso) return { day: "", month: "", year: "" };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { day: "", month: "", year: "" };
  return { day: String(d.getDate()), month: d.toLocaleDateString("en-IN", { month: "long" }), year: String(d.getFullYear()) };
}

function ConsentPage({ data }: { data: ConsentForm12BBPdfData }) {
  const { formData: f, statutoryData: s } = data;
  const name = [f.firstName, f.middleName, f.lastName].filter(Boolean).join(" ");
  const companyName = getCompanyName(data.recruitmentEntity);
  const regime = s.taxRegime || "";

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.letterTitle}>CONSENT &amp; SELF DECLARATION</Text>

      <Text style={{ textAlign: "right", marginBottom: 20 }}>Dated : {formattedDate(s.formADate).day ? `${formattedDate(s.formADate).day} ${formattedDate(s.formADate).month} ${formattedDate(s.formADate).year}` : ""}</Text>

      <Text style={{ marginBottom: 2 }}>To H.R/ Accounts Department</Text>
      <Text style={{ fontWeight: 700, marginBottom: 2 }}>{companyName}</Text>
      {LETTER_ADDRESS.map((l) => (
        <Text key={l} style={{ fontWeight: 700, marginBottom: 2 }}>{l}</Text>
      ))}

      <Text style={{ fontWeight: 700, marginTop: 12, marginBottom: 12 }}>
        Re: Consent &amp; Self Declaration for Deduction of Tax at Source from Salary for the F.Y {s.financialYear || "____________"}
      </Text>

      <Text style={{ marginBottom: 10 }}>Dear Sir/Madam,</Text>

      <Text style={styles.para}>
        I, Shri/ Smt/Kum {name || "____________________"}, Designation {data.designation || "____________________"}, having Employee Code
        No {data.employeeCode}, serving in the Office of {data.department || "____________________"} ( Branch/ Dept ), opt for the{" "}
        <Text style={{ fontWeight: 700 }}>{regime || "Old Tax Regime / New Tax Regime"}</Text> and hereby give my consent to compute,
        deduct and deposit my tax on Salary as per the {regime || "Old Tax Regime / New Tax Regime"} applicable for the F.Y{" "}
        {s.financialYear || "____________"}.
      </Text>
      <Text style={styles.para}>
        I may be allowed for the exemptions claimed for Old Tax Regime as per Form 12BB attached herewith for the F.Y{" "}
        {s.financialYear || "____________"}.
      </Text>

      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 24, marginBottom: 4 }}>
        <Text style={{ fontWeight: 700 }}>Name : {name}</Text>
        <Text style={{ fontWeight: 700 }}>Signature</Text>
      </View>
      <Text style={{ marginBottom: 2 }}>PAN: {f.panNumber || ""}</Text>
      <Text style={{ marginBottom: 2 }}>Phone No: {f.presentMobile || ""}</Text>
      <Text style={{ marginBottom: 16 }}>Mail Id : {f.presentEmail || ""}</Text>

      <Text style={{ fontWeight: 700, marginBottom: 4 }}>Note</Text>
      <Text style={{ fontSize: 8, marginBottom: 3 }}>1&nbsp;&nbsp;The option once exercised is final and can not be changed during the current F.Y {s.financialYear || ""}.</Text>
      <Text style={{ fontSize: 8, marginBottom: 3 }}>
        2&nbsp;&nbsp;Form 12BB has to be submitted by those who have opted the Old Tax Regime for getting tax benefit by
        submission/production of investment &amp; documents within the deadline notified by the employer.
      </Text>
      <Text style={{ fontSize: 8 }}>
        3&nbsp;&nbsp;If Consent and Self Declaration is not made by an Employee then his/her default tax regime is the new tax regime
        under section 115BAC.
      </Text>
    </Page>
  );
}

function Form12BBPage({ data }: { data: ConsentForm12BBPdfData }) {
  const { formData: f, statutoryData: s, chapter6ADeductions } = data;
  const name = [f.firstName, f.middleName, f.lastName].filter(Boolean).join(" ");
  const companyName = getCompanyName(data.recruitmentEntity);
  const filledDeductions = chapter6ADeductions.filter((d) => d.section || d.particulars || d.amount);

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.formTitle}>FORM NO.12BB</Text>
      <Text style={styles.formSubtitle}>(See rule 26C)</Text>

      <View style={styles.gridWrap}>
        <GridLine label="1. Name of the Employee :" value={name} />
        <GridLine label="2. Address of the Employee :" value={f.presentAddress} />
        <GridLine label="3. Permanent Account Number of the Employee :" value={f.panNumber} />
        <GridLine label="4. Financial Year :" value={s.financialYear} />
        <View style={[styles.gridLine, { borderBottomWidth: 0 }]}>
          <Text>5. TAX REGIME:</Text>
          <Text style={{ flexGrow: 1, marginLeft: 4, fontWeight: 700 }}>{s.taxRegime || ""}</Text>
        </View>
      </View>

      <Text style={{ fontSize: 8.5, fontWeight: 700, textAlign: "center", marginTop: 8, marginBottom: 4 }}>Details of claims and evidence thereof</Text>

      <View style={styles.gridWrap}>
        <View style={styles.claimHeaderRow}>
          <Text style={[styles.claimHeaderText, styles.slCol]}>Sl No.</Text>
          <Text style={[styles.claimHeaderText, styles.natureCol]}>Nature of claim</Text>
          <Text style={[styles.claimHeaderText, styles.amountCol]}>Amount (Rs.)</Text>
          <Text style={[styles.claimHeaderText, styles.evidenceCol]}>Evidence / Particulars with Document No&apos;s</Text>
        </View>
        <View style={styles.claimHeaderRow}>
          <Text style={[styles.claimHeaderText, styles.slCol]}>(1)</Text>
          <Text style={[styles.claimHeaderText, styles.natureCol]}>(2)</Text>
          <Text style={[styles.claimHeaderText, styles.amountCol]}>(3)</Text>
          <Text style={[styles.claimHeaderText, styles.evidenceCol]}>(4)</Text>
        </View>

        <View style={styles.claimRow}>
          <Text style={styles.slCol}>1</Text>
          <View style={styles.natureCol}>
            <Text style={{ fontWeight: 700, marginBottom: 3 }}>House Rent Allowance:</Text>
            <Text style={{ fontSize: 8, marginBottom: 2 }}>(i) Rent paid to the landlord</Text>
            <Text style={{ fontSize: 8, marginBottom: 2 }}>(ii) Name of the landlord: {s.landlordName || ""}</Text>
            <Text style={{ fontSize: 8, marginBottom: 2 }}>(iii) Address of the landlord: {s.landlordAddress || ""}</Text>
            <Text style={{ fontSize: 8, marginBottom: 2 }}>(iv) PAN of the landlord: {s.landlordPAN || ""}</Text>
            <Text style={{ fontSize: 7, color: MUTED }}>
              Note: PAN shall be furnished if the aggregate rent paid during the previous year exceeds Rs 1,00,000.00
            </Text>
          </View>
          <Text style={styles.amountCol}>{s.rentPaidToLandlord || ""}</Text>
          <Text style={styles.evidenceCol} />
        </View>

        <View style={styles.claimRow}>
          <Text style={styles.slCol}>2</Text>
          <Text style={styles.natureCol}>Leave Travel Concessions or assistance</Text>
          <Text style={styles.amountCol}>{s.ltcAmount || ""}</Text>
          <Text style={styles.evidenceCol} />
        </View>

        <View style={styles.claimRow}>
          <Text style={styles.slCol}>3</Text>
          <View style={styles.natureCol}>
            <Text style={{ fontWeight: 700, marginBottom: 3 }}>Deduction of Interest on borrowing : ( House Building Loan )</Text>
            <Text style={{ fontSize: 8, marginBottom: 2 }}>(i) Interest payable/paid to the Lender</Text>
            <Text style={{ fontSize: 8, marginBottom: 2 }}>(ii) Name of the lender: {s.lenderName || ""}</Text>
            <Text style={{ fontSize: 8, marginBottom: 2 }}>(iii) Address of the lender: {s.lenderAddress || ""}</Text>
            <Text style={{ fontSize: 8 }}>(iv) PAN of the lender ( Mandatory ): {s.lenderPAN || ""}</Text>
          </View>
          <Text style={styles.amountCol}>{s.homeLoanInterest || ""}</Text>
          <Text style={styles.evidenceCol} />
        </View>

        <View style={[styles.claimRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.slCol}>4</Text>
          <View style={styles.natureCol}>
            <Text style={{ fontWeight: 700, marginBottom: 3 }}>Deduction under Chapter VI-A (80C, 80CCC, 80CCD, 80D, 80E, 80G, 80TTA, etc.)</Text>
            {filledDeductions.length === 0 ? (
              <Text style={{ fontSize: 8, color: MUTED }}>None declared.</Text>
            ) : (
              filledDeductions.map((d, i) => (
                <Text key={i} style={{ fontSize: 8, marginBottom: 2 }}>
                  Section {d.section || "—"} — {d.particulars || ""}
                </Text>
              ))
            )}
          </View>
          <View style={styles.amountCol}>
            {filledDeductions.length === 0 ? (
              <Text> </Text>
            ) : (
              filledDeductions.map((d, i) => <Text key={i} style={{ marginBottom: 2 }}>{d.amount || ""}</Text>)
            )}
          </View>
          <Text style={styles.evidenceCol} />
        </View>
      </View>

      <Text style={{ fontSize: 8.5, fontWeight: 700, textAlign: "center", marginTop: 10, marginBottom: 4 }}>Verification</Text>
      <View style={styles.gridWrap}>
        <View style={[styles.gridLine, { borderBottomWidth: 0, padding: 6 }]}>
          <Text style={{ fontSize: 8.5 }}>
            I, {name || "………………………"}, Son/Daughter of {[f.fatherFirstName, f.fatherLastName].filter(Boolean).join(" ") || "………………………"}, do
            hereby certify that the information given above is complete and correct.
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", marginTop: 6 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ borderBottomWidth: 1, borderColor: B, paddingVertical: 4 }}>Place:</Text>
          <Text style={{ borderBottomWidth: 1, borderColor: B, paddingVertical: 4 }}>Date:</Text>
          <Text style={{ borderBottomWidth: 1, borderColor: B, paddingVertical: 4, fontWeight: 700 }}>Company Name : {companyName}</Text>
          <Text style={{ paddingVertical: 4, fontWeight: 700 }}>Branch/ Division : {data.department || ""}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ borderBottomWidth: 1, borderColor: B, paddingVertical: 4, fontStyle: "italic" }}>(Signature of the Employee)</Text>
          <Text style={{ borderBottomWidth: 1, borderColor: B, paddingVertical: 4, fontWeight: 700 }}>Full Name : {name}</Text>
          <Text style={{ borderBottomWidth: 1, borderColor: B, paddingVertical: 4, fontWeight: 700 }}>Employee ID: {data.employeeCode}</Text>
          <Text style={{ borderBottomWidth: 1, borderColor: B, paddingVertical: 4, fontWeight: 700 }}>Mail Id&apos;s : {f.presentEmail || ""}</Text>
          <Text style={{ paddingVertical: 4, fontWeight: 700 }}>Contact No&apos;s: {f.presentMobile || ""}</Text>
        </View>
      </View>
    </Page>
  );
}

export function ConsentForm12BBPdfDocument({ data }: { data: ConsentForm12BBPdfData }) {
  return (
    <Document>
      <ConsentPage data={data} />
      <Form12BBPage data={data} />
    </Document>
  );
}
