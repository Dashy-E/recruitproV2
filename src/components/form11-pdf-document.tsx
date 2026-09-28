import { Document, Page, View, Text, Svg, Polyline, StyleSheet } from "@react-pdf/renderer";
import type { FormData, StatutoryFormsData, PreviousPfEmploymentRow } from "@/app/dashboard/employee-portal/page";

// Replica of the official "Composite Declaration Form - 11" (EPFO, EPF
// Scheme 1952 Para 34 & 57 / EPS 1995 Para 24) — the numbered-grid layout on
// page 1, plus the Undertaking and (mostly office-only) Declaration by
// Present Employer on page 2. Section B/C's tick-boxes and the employer's
// own signature/seal are the employer's declaration, not employee data, and
// are left blank — the section is still printed since it's part of the
// form. No EPFO seal/logo asset exists in this app, so the header is
// text-only.
export interface Form11PdfData {
  employeeCode: string;
  department: string | null;
  designation: string | null;
  formData: FormData;
  statutoryData: StatutoryFormsData;
  previousPfEmployment: PreviousPfEmploymentRow[];
}

const B = "#000";
const MUTED = "#6b7280";

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 8.5, fontFamily: "Helvetica", color: B, lineHeight: 1.3 },
  webLink: { position: "absolute", top: 26, right: 30, fontSize: 8 },
  title: { fontSize: 13, fontWeight: 700, textAlign: "center" },
  centerLine: { fontSize: 9, textAlign: "center" },
  italicLine: { fontSize: 8, fontStyle: "italic", textAlign: "center" },
  gridWrap: { borderTopWidth: 1, borderColor: B, marginTop: 10 },
  gridRow: { flexDirection: "row", borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: B, padding: 5, alignItems: "flex-start" },
  gridNum: { width: 16, fontSize: 8.5 },
  tableWrap: { borderWidth: 0.75, borderColor: B, marginTop: 4 },
  tableHeaderRow: { flexDirection: "row", backgroundColor: "#f3f4f6" },
  tableRow: { flexDirection: "row" },
  th: { fontSize: 6.5, fontWeight: 700, textAlign: "center", padding: 3, borderRight: `0.75pt solid ${B}`, borderBottom: `0.75pt solid ${B}` },
  td: { fontSize: 7.5, padding: 3, minHeight: 20, borderRight: `0.75pt solid ${B}`, borderBottom: `0.75pt solid ${B}` },
  checkboxOuter: { width: 9, height: 9, backgroundColor: B, alignItems: "center", justifyContent: "center" },
  checkboxInner: { position: "absolute", top: 1.2, left: 1.2, right: 1.2, bottom: 1.2, backgroundColor: "#fff" },
});

// Drawn checkbox — Helvetica/WinAnsi has no glyph for the Unicode box
// characters (■/□), so those render as a garbled fallback char; a small
// filled/unfilled square avoids that entirely, same technique as the other
// statutory forms' checkboxes.
function Tick() {
  return (
    <Svg width={5.5} height={5.5} viewBox="0 0 12 12">
      <Polyline points="2,6.5 5,9.5 10,2.5" stroke="#fff" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function CBox({ checked }: { checked?: boolean }) {
  return (
    <View style={styles.checkboxOuter}>
      {!checked && <View style={styles.checkboxInner} />}
      {checked && <Tick />}
    </View>
  );
}
function CheckLine({ checked, children }: { checked?: boolean; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
      <CBox checked={checked} />
      <Text style={{ marginLeft: 5 }}>{children}</Text>
    </View>
  );
}

function GridRow({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <View style={styles.gridRow}>
      <Text style={styles.gridNum}>{n}</Text>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

// Every field in the grid shares this same label-column width, so every
// value/underline in the whole form starts at the same x position instead
// of trailing right after wherever that row's own label text happens to
// end — that's what makes the form read as one consistent table instead of
// a series of independently-sized rows. Long labels (e.g. item 5's full
// "Marital Status: (...)") wrap to a second line inside their column
// rather than pushing the value out of alignment.
const LABEL_W = 250;

// `label` can be plain text or a small block of JSX (e.g. item 2's two
// checkbox lines) — either way it's pinned to LABEL_W and the value column
// starts at the same offset. Root is a row, so this is safe to stack
// several per GridRow without the flex-in-column pitfall noted above.
function Split({ label, value, plainValue }: { label: React.ReactNode; value?: string | null; plainValue?: boolean }) {
  return (
    <View style={{ flexDirection: "row", marginBottom: 5 }}>
      <View style={{ width: LABEL_W, paddingRight: 8 }}>
        {typeof label === "string" ? <Text>{label}</Text> : label}
      </View>
      <Text
        style={
          plainValue
            ? { flex: 1, fontWeight: 700, paddingLeft: 8 }
            : { flex: 1, borderBottom: `0.5pt solid ${B}`, minHeight: 11, paddingLeft: 8, fontWeight: 700 }
        }
      >
        {value || ""}
      </Text>
    </View>
  );
}

function yesNoText(value?: string | null): string {
  return value === "Yes" ? "Yes" : value === "No" ? "No" : "";
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

function UndertakingPage({ data }: { data: Form11PdfData }) {
  const { formData: f } = data;
  const name = [f.salutation, f.firstName, f.middleName, f.lastName].filter(Boolean).join(" ");
  return (
    <Page size="A4" style={styles.page}>
      <Text style={{ fontSize: 11, fontWeight: 700, textDecoration: "underline", textAlign: "center", marginBottom: 14 }}>UNDERTAKING</Text>

      <Text style={{ marginBottom: 8 }}>1)&nbsp;&nbsp;Certified that the particulars are true to the best of my knowledge.</Text>
      <Text style={{ marginBottom: 8 }}>2)&nbsp;&nbsp;I authorize EPFO to use my Aadhar for verification/authentication/e-KYC purpose for service delivery.</Text>
      <Text style={{ marginBottom: 8 }}>
        3)&nbsp;&nbsp;Kindly transfer the funds and service details, if applicable, from the previous PF account as
        declared above to the present P.F. Account as I am an Aadhar verified employee in my previous PF Account.*
      </Text>
      <Text style={{ marginBottom: 24 }}>4)&nbsp;&nbsp;In case of changes in above details, the same will be intimated to employer at the earliest.</Text>

      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 40 }}>
        <View>
          <Text>Date: {data.statutoryData.formADate || ""}</Text>
          <Text>Place:</Text>
        </View>
        <Text style={{ alignSelf: "flex-end" }}>Signature of Member</Text>
      </View>

      <Text style={{ fontSize: 11, fontWeight: 700, textDecoration: "underline", textAlign: "center", marginBottom: 14 }}>DECLARATION BY PRESENT EMPLOYER</Text>

      <View style={{ flexDirection: "row", alignItems: "flex-end", marginBottom: 10 }}>
        <Text>A.&nbsp;&nbsp;The member Mr/Ms/Mrs</Text>
        <Text style={{ flexGrow: 1, borderBottom: `0.75pt solid ${B}`, marginLeft: 4, marginRight: 4, fontWeight: 700 }}>{name}</Text>
        <Text>has joined on</Text>
        <Text style={{ width: 80, borderBottom: `0.75pt solid ${B}`, marginLeft: 4, marginRight: 4, fontWeight: 700 }}>{f.dateOfJoining || ""}</Text>
        <Text>and has been</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", marginBottom: 14 }}>
        <Text>allotted PF No.</Text>
        <Text style={{ flexGrow: 1, borderBottom: `0.75pt solid ${B}`, marginLeft: 4, marginRight: 8 }} />
        <Text>and UAN</Text>
        <Text style={{ flexGrow: 1, borderBottom: `0.75pt solid ${B}`, marginLeft: 4 }} />
      </View>

      <Text style={{ marginBottom: 6 }}>B.&nbsp;&nbsp;In case the person was earlier not a member of EPF Scheme, 1952 and EPS, 1995:</Text>
      <Text style={{ fontWeight: 700, marginBottom: 6, marginLeft: 14 }}>Please Tick the Appropriate Option:</Text>
      <Text style={{ marginBottom: 4, marginLeft: 14 }}>The KYC details of the above member in the UAN database</Text>
      <View style={{ marginLeft: 22 }}>
        <CheckLine>Have not been uploaded</CheckLine>
        <CheckLine>Have been uploaded but not approved</CheckLine>
        <View style={{ marginBottom: 12 }}><CheckLine>Have been uploaded and approved with DSC/e-sign.</CheckLine></View>
      </View>

      <Text style={{ marginBottom: 6 }}>C.&nbsp;&nbsp;In case the person was earlier a member of EPF Scheme, 1952 and EPS, 1995:</Text>
      <Text style={{ fontWeight: 700, marginBottom: 6, marginLeft: 14 }}>Please Tick the Appropriate Option:-</Text>
      <View style={{ marginLeft: 22 }}>
        <View style={{ flexDirection: "row", marginBottom: 4 }}>
          <CBox />
          <Text style={{ marginLeft: 5, flex: 1 }}>
            The KYC details of the above member in the UAN database have been approved with E-sign/Digital
            Signature Certificate and transfer request has been generated on portal.
          </Text>
        </View>
        <View style={{ flexDirection: "row", marginBottom: 30 }}>
          <CBox />
          <Text style={{ marginLeft: 5, flex: 1 }}>
            The previous Account of the member is not Aadhar verified and hence physical transfer form shall be
            initiated.
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 30 }}>
        <Text>Date:</Text>
        <Text style={{ textAlign: "right" }}>Signature of Employer with Seal{"\n"}of Establishment</Text>
      </View>

      <Text style={{ fontSize: 7, color: MUTED, lineHeight: 1.4 }}>
        *Auto transfer of previous PF account would be possible in respect of Aadhar verified employees only. Other
        employees are requested to file physical claim (Form-13) for transfer of account from the previous
        establishment.
      </Text>
    </Page>
  );
}

export function Form11PdfDocument({ data }: { data: Form11PdfData }) {
  const { formData: f, statutoryData: s, previousPfEmployment } = data;
  const name = [f.salutation, f.firstName, f.middleName, f.lastName].filter(Boolean).join(" ");
  const fatherName = [f.fatherFirstName, f.fatherLastName].filter(Boolean).join(" ");
  const filledPrevPf = previousPfEmployment.filter((r) => r.establishment);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.webLink}>www.epfindia.gov.in</Text>
        <Text style={styles.title}>Composite Declaration Form -11</Text>
        <Text style={styles.italicLine}>(To be retained by the employer for future reference)</Text>
        <Text style={[styles.centerLine, { fontWeight: 700, marginTop: 4 }]}>EMPLOYEES&apos; PROVIDENT FUND ORGANISATION</Text>
        <Text style={[styles.centerLine, { fontWeight: 700 }]}>Employees&apos; Provident Funds Scheme, 1952 (Paragraph 34 &amp; 57) &amp;</Text>
        <Text style={[styles.centerLine, { fontWeight: 700 }]}>Employees&apos; Pension Scheme, 1995 (Paragraph 24)</Text>
        <Text style={styles.italicLine}>(Declaration by a person taking up employment in any establishment on which EPF Scheme, 1952 and /or EPS, 1995 is applicable)</Text>

        <View style={styles.gridWrap}>
          <GridRow n="1">
            <Split label="Name of the member" value={name} />
          </GridRow>
          <GridRow n="2">
            <Split
              label={<><CheckLine checked>Father&apos;s Name</CheckLine><CheckLine>Spouse&apos;s Name</CheckLine></>}
              value={fatherName}
            />
          </GridRow>
          <GridRow n="3">
            <Split label="Date of Birth ( DD / MM / YYYY )" value={f.dateOfBirth} />
          </GridRow>
          <GridRow n="4">
            <Split label="Gender: (Male/Female/Transgender)" value={f.gender} />
          </GridRow>
          <GridRow n="5">
            <Split label="Marital Status: (Married/Unmarried/Widow/Widower/Divorcee)" value={f.maritalStatus} />
          </GridRow>
          <GridRow n="6">
            <Split label="(a) Email ID:" value={f.presentEmail} />
            <Split label="(b) Mobile No.:" value={f.presentMobile} />
          </GridRow>
          <GridRow n="7">
            <Text style={{ fontWeight: 700, marginBottom: 5 }}>Present employment details:</Text>
            <Split label="Date of joining in the current establishment (DD/MM/YYYY)" value={f.dateOfJoining} />
          </GridRow>
          <GridRow n="8">
            <Text style={{ fontWeight: 700, marginBottom: 5 }}>KYC Details: (attach self attested copies of following KYCs)</Text>
            <Split label="a) Bank Account No. :" value={f.bankAccountNumber} />
            <Split label="b) IFS Code of the branch:" value={f.ifscCode} />
            <Split label="c) AADHAR Number" value={f.aadhaarNumber} />
            <Split label="d) Permanent Account Number (PAN), if available" value={f.panNumber} />
          </GridRow>
          <GridRow n="9">
            <Split label="Whether earlier a member of Employees&apos; Provident Fund Scheme, 1952" value={yesNoText(s.previousPfMember)} plainValue />
          </GridRow>
          <GridRow n="10">
            <Split label="Whether earlier a member of Employees&apos; Pension Scheme, 1995" value={yesNoText(s.previousPensionMember)} plainValue />
          </GridRow>
          <GridRow n="11">
            <Text style={{ fontWeight: 700, marginBottom: 5 }}>Previous employment details: [if Yes to 9 AND/OR 10 above] — Un-exempted</Text>
            <Table
              headers={["Establishment\nName & Address", "UAN", "PF Account\nNumber", "Date of\njoining", "Date of\nexit", "Scheme Cert.\nNo. (if issued)", "PPO\nNumber", "NCP\nDays"]}
              widths={[1.6, 0.9, 0.8, 0.7, 0.7, 0.9, 0.7, 0.6]}
              rows={filledPrevPf.map((r) => [r.establishment, r.uan, r.pfNumber, r.dateOfJoining, r.dateOfExit, r.schemeCertNo, r.ppoNumber, r.ncpDays])}
            />
          </GridRow>
          <GridRow n="12">
            <Text style={{ fontWeight: 700, marginBottom: 5 }}>Previous employment details: [if Yes to 9 AND/OR 10 above] — For Exempted Trusts</Text>
            <Table
              headers={["Name & Address\nof the Trust", "UAN", "Member EPS\nA/c Number", "Date of\njoining", "Date of\nexit", "Scheme Cert.\nNo. (if issued)", "NCP\nDays"]}
              widths={[1.8, 0.9, 0.9, 0.7, 0.7, 0.9, 0.6]}
              rows={[]}
            />
          </GridRow>
          <GridRow n="13">
            <Split label="a) International Worker:" value={yesNoText(s.isInternationalWorker)} plainValue />
            <Split label="b) If yes, state country of origin (India/Name of other country)" value={s.isInternationalWorker === "Yes" ? s.countryOfOrigin : ""} />
            <Split label="c) Passport No." value={f.passportNumber} />
            <Split label="d) Validity of passport [(DD/MM/YYYY) to (DD/MM/YYYY)]" value="" />
          </GridRow>
        </View>
      </Page>
      <UndertakingPage data={data} />
    </Document>
  );
}
