import { Document, Page, View, Text, Image, Svg, Polyline, StyleSheet } from "@react-pdf/renderer";
import type {
  FormData, EducationRow, EmploymentRow, AppFormData, ReferenceRow, LanguageRow,
} from "@/app/dashboard/employee-portal/page";

// Replica of the paper "Application Form of Mitra S K Pvt. Ltd." (boxed/
// framed layout — instructions panel + photo box, bordered sections, D-D-M-M-
// Y-Y date boxes, rectangular Yes/No checkboxes) — combines the Employee
// Information Form data with the Application Form section's extra fields
// (see employee-portal/page.tsx) into the same 5-page structure as the
// original PDF. Fields the app has no source for (photograph, org-chart
// drawing, signature, "Branch") are left blank, same spirit as the offer
// letter's blank Ref. No. line.
export interface ApplicationFormPdfData {
  employeeCode: string;
  department: string | null;
  designation: string | null;
  recruitmentEntity: string | null;
  formData: FormData;
  education: EducationRow[];
  employment: EmploymentRow[];
  appFormData: AppFormData;
  references: ReferenceRow[];
  professionalQualifications: EducationRow[];
  languages: LanguageRow[];
  enclosures: string[];
}

// Same 3-entity letterhead selection as the MRF PDF (mrf-pdf-document.tsx),
// keyed off the candidate's `recruitmentEntity` instead of an org-unit path —
// Primawave and Gemini are their own legal entities with their own logo,
// everything else prints under the MSK banner.
function getLogoSrc(recruitmentEntity: string | null): string {
  if (recruitmentEntity?.includes("Primawave")) return "/logos/PRIMAWAVE4_TRANS.png";
  if (recruitmentEntity?.includes("Gemini")) return "/logos/Gemini.png";
  return "/logos/msklogo.jpg";
}

const B = "#000";
const MUTED = "#6b7280";

// NOTE ON A REACT-PDF PITFALL: a View/Text with `flex:1` fights the Yoga
// layout engine's unbounded main-axis when it's the bare child of a
// column-direction container (the default), collapsing its height and
// overlapping whatever renders next. Every "standalone" helper below
// (Line, DateBoxes, NameRow, YesNoRow, ...) therefore keeps `flex` OFF its
// own root and only uses it on children that are inside an explicit
// `flexDirection:"row"` wrapper, where the row bounds the width instead.
//
// A second, separate pitfall: a *stroked* rectangle border — via the
// `border` shorthand or the longhand borderWidth/borderColor/borderStyle,
// it doesn't matter which — can leave a hairline gap at a corner once you
// zoom in, because react-pdf/pdfkit draws the 4 sides as independent line
// segments that don't always land on exactly the same sub-pixel position
// where they meet. There is no CSS-level fix for that. Every rectangle
// border in this document (`Bordered`, `RuledFrame`, the checkboxes and
// date-digit boxes) is therefore drawn as solid filled rectangles instead —
// a black rectangle with a smaller white rectangle inset on top — since a
// fill has no corners to join and so cannot show this at any zoom level.

const styles = StyleSheet.create({
  page: { padding: 22, fontSize: 9, fontFamily: "Helvetica", color: B },
  footer: { position: "absolute", bottom: 16, left: 0, right: 0, textAlign: "center", fontSize: 8.5, color: B },
  logoRow: { alignItems: "center", marginBottom: 8 },
  logo: { width: 140, height: 46, objectFit: "contain" },
  // Primawave's logo is a wider landscape mark than the shared box — same
  // adjustment the MRF PDF makes for it (mrf-pdf-document.tsx's logoPspl).
  logoWide: { width: 150, height: 60, objectFit: "contain" },
  titleText: { fontSize: 17, fontWeight: 700, textAlign: "center" },
  boxTitle: { fontSize: 10, fontWeight: 700, textDecoration: "underline", marginBottom: 7 },
  caption: { fontSize: 6.5, color: MUTED },
  tableHeaderRow: { flexDirection: "row", backgroundColor: "#f3f4f6" },
  tableRow: { flexDirection: "row" },
  th: { fontSize: 7.5, fontWeight: 700, textAlign: "center", padding: 5, borderRight: `0.75pt solid ${B}`, borderBottom: `0.75pt solid ${B}` },
  td: { fontSize: 8.5, padding: 5, minHeight: 20, borderRight: `0.75pt solid ${B}`, borderBottom: `0.75pt solid ${B}` },
  // Checkboxes and date-digit boxes are drawn as two solid filled rectangles
  // (a black square with a smaller white square on top, inset by the
  // "border" width) rather than a stroked border — a fill has no corners to
  // join, so this is fully immune to the hairline-gap issue above, at any
  // zoom level.
  checkboxOuter: { width: 13, height: 12, backgroundColor: B, alignItems: "center", justifyContent: "center" },
  checkboxInner: { position: "absolute", top: 1.4, left: 1.4, right: 1.4, bottom: 1.4, backgroundColor: "#fff" },
  dateBoxOuter: { width: 16, height: 17, backgroundColor: B, alignItems: "center", justifyContent: "center", marginRight: 3 },
  dateBoxInner: { position: "absolute", top: 1.4, left: 1.4, right: 1.4, bottom: 1.4, backgroundColor: "#fff" },
});

function Tick() {
  return (
    <Svg width={7.5} height={7.5} viewBox="0 0 12 12">
      <Polyline points="2,6.5 5,9.5 10,2.5" stroke="#fff" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// A "double-ruled" border (thin outer line, small gap, thick inner line) —
// same technique as the checkboxes: nested solid-color fills instead of two
// separately-stroked boxes. Two independent strokes drawn this close
// together can land a fraction of a point apart at their corners, which
// renders as a visible step/notch once zoomed in; solid fills have no
// strokes to misalign, so this can't show that at any zoom level.
//
// No `flex:1` on these layers: this frame's own height is meant to be
// driven by its content (like everything else on the page, which just flows
// top to bottom with no bounded height to fill), and `flex:1` on a fill
// layer whose *own* parent's height is itself content-driven creates a
// circular sizing dependency that collapses the whole subtree to zero
// height — this is the flex:1-in-column pitfall noted above, and it isn't
// limited to stacked siblings; a lone flex:1 child of an auto-height parent
// hits it too, once that parent is itself nested a few levels deep in an
// auto-height ancestor. `Bordered` below takes an explicit `fill` prop for
// the one case (a box stretched taller by a row sibling, e.g. the photo box
// next to the instructions panel) where the parent's height genuinely *is*
// externally bounded and flex:1 is safe.
function RuledFrame({ children, thin, gap, thick, contentStyle }: { children: React.ReactNode; thin: number; gap: number; thick: number; contentStyle?: Record<string, string | number> }) {
  return (
    <View style={{ backgroundColor: B, padding: thin }}>
      <View style={{ backgroundColor: "#fff", padding: gap }}>
        <View style={{ backgroundColor: B, padding: thick }}>
          <View style={{ backgroundColor: "#fff", ...contentStyle }}>
            {children}
          </View>
        </View>
      </View>
    </View>
  );
}

// Single-ruled border — same fill-not-stroke technique as RuledFrame above,
// applied everywhere a plain rectangle border is needed (previously done
// with a stroked `borderWidth`, which — shorthand or explicit longhand —
// can still show a hairline gap at a corner once zoomed in; a fill can't).
// Pass `fill` only when this box is a row-sibling stretched taller by
// another box (see the note above RuledFrame) — every other usage must
// leave it off, or the inner layer's flex:1 collapses the box.
function Bordered({ children, width = 1, fill = false, style, contentStyle }: {
  children?: React.ReactNode; width?: number; fill?: boolean;
  style?: Record<string, string | number>; contentStyle?: Record<string, string | number>;
}) {
  return (
    <View style={{ backgroundColor: B, padding: width, marginBottom: 9, ...style }}>
      <View style={{ backgroundColor: "#fff", padding: 9, ...(fill ? { flex: 1 } : {}), ...contentStyle }}>
        {children}
      </View>
    </View>
  );
}

function CBox({ checked }: { checked: boolean }) {
  return (
    <View style={styles.checkboxOuter}>
      {!checked && <View style={styles.checkboxInner} />}
      {checked && <Tick />}
    </View>
  );
}

// Checkbox immediately followed by its own label, e.g. "Permanent [x]" — used
// as a child inside an explicit row (Employment Type, Gender, Marital
// Status, Yes/No pairs), never standalone. `alignItems:"center"` on the
// label+box pair (rather than relying on the parent row) is what keeps every
// checkbox sitting on the same baseline as its text regardless of what else
// is in that row.
function Opt({ label, checked }: { label: string; checked: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginRight: 14 }}>
      <Text style={{ marginRight: 4 }}>{label}</Text>
      <CBox checked={checked} />
    </View>
  );
}

// Standalone "Label : ___value___" line — safe to stack directly in a column
// (its own root carries no flex; the row is internal and self-bounded).
function Line({ label, value, bold = true }: { label: string; value?: string | null; bold?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", marginBottom: 6 }}>
      {label && <Text style={{ marginRight: 4 }}>{label} :</Text>}
      <Text style={{ flexGrow: 1, borderBottom: `0.75pt solid ${B}`, minHeight: 13, paddingLeft: 2, fontWeight: bold ? 700 : 400 }}>{value || ""}</Text>
    </View>
  );
}

// A block of ruled lines for a free-text answer (career objective, hobbies,
// etc.) — `lines` controls how many ruled lines are drawn under the text.
function RuledBlock({ value, lines = 3 }: { value?: string | null; lines?: number }) {
  return (
    <View>
      <Text style={{ minHeight: 13, marginBottom: 3 }}>{value || ""}</Text>
      {Array.from({ length: Math.max(lines - 1, 0) }).map((_, i) => (
        <View key={i} style={{ borderBottom: `0.75pt solid ${B}`, minHeight: 13 }} />
      ))}
    </View>
  );
}

function dateDigits(iso: string | null | undefined): string[] {
  if (!iso) return ["", "", "", "", "", ""];
  const d = new Date(iso);
  if (isNaN(d.getTime())) return ["", "", "", "", "", ""];
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return [dd[0], dd[1], mm[0], mm[1], yy[0], yy[1]];
}

function ageFromDob(iso: string | null | undefined): string {
  if (!iso) return "";
  const dob = new Date(iso);
  if (isNaN(dob.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age >= 0 ? String(age) : "";
}

// "Label  D D M M Y Y" — standalone-safe (root has no flex).
function DateBoxes({ label, iso }: { label: string; iso?: string | null }) {
  const digits = dateDigits(iso);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
      <Text style={{ width: 84, fontWeight: 700 }}>{label}</Text>
      {digits.map((d, i) => (
        <View key={i} style={styles.dateBoxOuter}>
          <View style={styles.dateBoxInner} />
          <Text style={{ fontSize: 9, fontWeight: 700 }}>{d}</Text>
        </View>
      ))}
    </View>
  );
}

// "Label : ___" boxed value with a small caption underneath, used as a
// sibling inside an explicit row (flex is fine there).
function BoxField({ label, value, flex = 1 }: { label: string; value?: string | null; flex?: number }) {
  return (
    <View style={{ flex }}>
      <Text style={{ borderBottom: `0.75pt solid ${B}`, minHeight: 14, fontWeight: 700 }}>{value || ""}</Text>
      <Text style={styles.caption}>{label}</Text>
    </View>
  );
}

function fullName(first: string, middle: string, family: string): string {
  return [first, middle, family].filter(Boolean).join(" ");
}

function Table({ headers, rows, widths }: { headers: string[]; rows: string[][]; widths?: number[] }) {
  return (
    <Bordered width={1.1} style={{ marginBottom: 0 }} contentStyle={{ padding: 0 }}>
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
    </Bordered>
  );
}

// "Name : Mr.  [Initial] [First] [Middle] [Family/Surname]" block —
// standalone-safe (root has no flex; the two internal rows are bounded).
function NameRow({ prefixLabel, prefixValue, initial, first, middle, family }: {
  prefixLabel: string; prefixValue: string; initial: string; first: string; middle: string; family: string;
}) {
  return (
    <View style={{ marginBottom: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", marginBottom: 3 }}>
        <Text style={{ width: 68, fontWeight: 700 }}>{prefixLabel}</Text>
        <Text style={{ marginRight: 5 }}>:</Text>
        <Text style={{ fontWeight: 700, paddingTop: 5 }}>{prefixValue}</Text>
      </View>
      <View style={{ flexDirection: "row" }}>
        <View style={{ width: 68 }} />
        <View style={{ width: 42, marginRight: 8 }}>
          <Text style={{ borderBottom: `0.75pt solid ${B}`, minHeight: 14, fontWeight: 700 }}>{initial}</Text>
          <Text style={styles.caption}>Initial</Text>
        </View>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={{ borderBottom: `0.75pt solid ${B}`, minHeight: 14, fontWeight: 700 }}>{first}</Text>
          <Text style={styles.caption}>First</Text>
        </View>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={{ borderBottom: `0.75pt solid ${B}`, minHeight: 14, fontWeight: 700 }}>{middle}</Text>
          <Text style={styles.caption}>Middle</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ borderBottom: `0.75pt solid ${B}`, minHeight: 14, fontWeight: 700 }}>{family}</Text>
          <Text style={styles.caption}>Family / Surname</Text>
        </View>
      </View>
    </View>
  );
}

// "Question?  Yes [ ]  No [ ]" — standalone-safe (root is an explicit row).
function YesNoRow({ question, checked, marginBottom = 5 }: { question: string; checked: string; marginBottom?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom }}>
      <Text style={{ flex: 1 }}>{question}</Text>
      <Opt label="Yes" checked={checked === "Yes"} />
      <Opt label="No" checked={checked === "No"} />
    </View>
  );
}

function ApplicationFormPage1({ data }: { data: ApplicationFormPdfData }) {
  const { formData: f, appFormData: af } = data;
  return (
    <Page size="A4" style={styles.page}>
      <RuledFrame thin={0.75} gap={3} thick={1.4} contentStyle={{ padding: 13 }}>
        <View style={styles.logoRow}>
          <Image
            src={getLogoSrc(data.recruitmentEntity)}
            style={data.recruitmentEntity?.includes("Primawave") ? styles.logoWide : styles.logo}
          />
        </View>

        <View style={{ flexDirection: "row", marginBottom: 10 }}>
          <Bordered style={{ flex: 1, marginRight: 10, marginBottom: 0 }} contentStyle={{ padding: 8 }}>
            <Text style={{ fontSize: 9, fontWeight: 700, marginBottom: 5 }}>PLEASE READ THESE INSTRUCTIONS CAREFULLY</Text>
            <Text style={{ fontSize: 8, marginBottom: 3 }}>1  Do not leave any item blank. If it is not applicable to you, indicate &quot;N.A.&quot;</Text>
            <Text style={{ fontSize: 8, marginBottom: 3 }}>2  Please attach a scanned copy of your passport showing all relevant details.</Text>
            <Text style={{ fontSize: 8 }}>3  False particulars or willful suppression of material facts will render you liable to disqualification, or, if appointed, to termination and/or appropriate legal proceedings.</Text>
          </Bordered>
          <Bordered fill style={{ width: 150, marginBottom: 0 }} contentStyle={{ padding: 6, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 8, color: MUTED, textAlign: "center" }}>Please Attach a Recent Passport Size Photograph</Text>
          </Bordered>
        </View>

        <View style={{ marginBottom: 9 }}>
          <RuledFrame thin={0.5} gap={2} thick={1.3} contentStyle={{ paddingVertical: 9 }}>
            <Text style={styles.titleText}>APPLICATION FORM OF MITRA S K PVT. LTD.</Text>
          </RuledFrame>
        </View>

        <Bordered contentStyle={{ paddingVertical: 7 }}>
          <Line label="Position Applied For" value={af.positionAppliedFor} />
        </Bordered>

        <Bordered>
          <NameRow prefixLabel="Name" prefixValue={f.salutation || "Mr/Mrs/Ms"} initial={af.nameInitial} first={f.firstName} middle={f.middleName} family={f.lastName} />
          <NameRow prefixLabel="Father's Name" prefixValue="Mr." initial={af.fatherInitial} first={f.fatherFirstName} middle="" family={f.fatherLastName} />
        </Bordered>

        <View style={{ flexDirection: "row", marginBottom: 9 }}>
          <Bordered style={{ flex: 1, marginRight: 10, marginBottom: 0 }}>
            <Text style={styles.boxTitle}>Present Postal Address</Text>
            <Text style={{ borderBottom: `0.75pt solid ${B}`, minHeight: 50, marginBottom: 6 }}>{f.presentAddress || ""}</Text>
            <Line label="" value={f.presentPinCode ? `PIN: ${f.presentPinCode}` : ""} />
            <Line label="Residence Tel." value={af.presentResidenceTel} />
            <Line label="Mobile Tel." value={f.presentMobile} />
            <Line label="Email Address" value={f.presentEmail} bold={false} />
          </Bordered>
          <Bordered style={{ flex: 1, marginBottom: 0 }}>
            <Text style={styles.boxTitle}>Permanent Postal Address</Text>
            <Text style={{ borderBottom: `0.75pt solid ${B}`, minHeight: 50, marginBottom: 6 }}>{f.permanentAddress || ""}</Text>
            <Line label="" value={f.permanentPinCode ? `PIN: ${f.permanentPinCode}` : ""} />
            <Line label="Residence Tel." value={af.permanentResidenceTel} />
            <Line label="Mobile Tel." value={f.permanentMobile} />
            <Line label="Email Address" value={af.permanentEmail} bold={false} />
          </Bordered>
        </View>

        <Text style={styles.boxTitle}>Bank Details</Text>
        <View style={{ marginBottom: 6 }}>
          <Table
            headers={["Bank Name", "Employee Name as per Bank A/c Name", "Bank Branch Name", "Branch Address", "Account Number", "IFSC Code & MICR"]}
            rows={[[
              f.bankName || "", f.employeeNameAsPerBank || "", f.bankBranchName || "",
              af.bankBranchAddress || "", f.bankAccountNumber || "",
              [f.ifscCode, af.micrCode].filter(Boolean).join(" / "),
            ]]}
          />
        </View>
        <Text style={{ fontSize: 8, fontWeight: 700 }}>Note: Kindly attach Photo copy of Passbook front page or Cancel Cheque Leaf</Text>
      </RuledFrame>
      <Text style={styles.footer}>Page 1 of 5</Text>
    </Page>
  );
}

function ApplicationFormPage2({ data }: { data: ApplicationFormPdfData }) {
  const { formData: f, appFormData: af } = data;
  const documentRows: string[][] = [
    ["Aadhaar Card", f.firstName ? fullName(f.firstName, f.middleName, f.lastName) : "", f.aadhaarNumber || ""],
    ["Passport", "", f.passportNumber || ""],
    ["Driving Licence", "", af.drivingLicenceNumber || ""],
    ["Election Card", "", af.electionCardNumber || ""],
    ["Ration Card", "", af.rationCardNumber || ""],
    ["ESIC Card", "", f.esicNumber || ""],
    ["Others", "", af.otherDocumentNumber || ""],
  ];

  return (
    <Page size="A4" style={styles.page}>
      <RuledFrame thin={0.75} gap={3} thick={1.4} contentStyle={{ padding: 13 }}>
        <Text style={styles.boxTitle}>Personal Details</Text>

        <Bordered>
          <View style={{ flexDirection: "row" }}>
            <View style={{ flex: 1 }}>
              <DateBoxes label="Date of Birth" iso={f.dateOfBirth} />
              <DateBoxes label="Date of Joining" iso={f.dateOfJoining} />
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                <Text style={{ width: 108 }}>Employment Type</Text>
                <Opt label="Permanent" checked={af.employmentType === "Permanent"} />
                <Opt label="Contractual" checked={af.employmentType === "Contractual"} />
              </View>
            </View>
            <View style={{ width: 160 }}>
              <Line label="" value={af.height ? `${af.height} [In Cms.]` : ""} />
              <Line label="" value={af.weight ? `${af.weight} [In Kgs.]` : ""} />
              <Line label="Religion" value={f.religion} />
            </View>
          </View>

          <View style={{ flexDirection: "row", marginBottom: 6 }}>
            <BoxField label="Blood Group" value={f.bloodGroup} flex={1} />
            <View style={{ width: 10 }} />
            <BoxField label="Age" value={ageFromDob(f.dateOfBirth)} flex={1} />
            <View style={{ flex: 2 }} />
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
            <Text style={{ width: 108 }}>Gender</Text>
            <Opt label="Male" checked={f.gender === "Male"} />
            <Opt label="Female" checked={f.gender === "Female"} />
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
            <Text style={{ width: 108 }}>Marital Status</Text>
            {["Single", "Married", "Divorced", "Separated", "Widowed"].map((opt) => (
              <Opt key={opt} label={opt} checked={f.maritalStatus === opt} />
            ))}
          </View>

          {f.maritalStatus === "Married" && (
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
              <Text style={{ marginRight: 5 }}>If Married, Spouse Name</Text>
              <Text style={{ flexGrow: 1, borderBottom: `0.75pt solid ${B}`, minHeight: 13, fontWeight: 700, marginRight: 12 }}>{af.spouseName || ""}</Text>
              <DateBoxes label="Date of Birth" iso={f.spouseDateOfBirth} />
            </View>
          )}

          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
            <Text style={{ marginRight: 7 }}>Do you have any children ?</Text>
            <Opt label="Yes" checked={f.hasChildren === "Yes"} />
            <Text style={{ marginRight: 12 }}>No</Text>
            <View style={{ width: 14 }} />
            <BoxField label="No. Of Son (s)" value={af.numberOfSons} flex={1} />
            <View style={{ width: 10 }} />
            <BoxField label="No. Of Daughter (s)" value={af.numberOfDaughters} flex={1} />
          </View>

          <View style={{ flexDirection: "row" }}>
            <BoxField label="Branch" value="" flex={1} />
            <View style={{ width: 10 }} />
            <BoxField label="Department" value={data.department} flex={1} />
            <View style={{ width: 10 }} />
            <BoxField label="Designation" value={data.designation} flex={1} />
          </View>
        </Bordered>

        <Table headers={["Document Type", "Name as on Document", "Number"]} widths={[1, 1.4, 1.2]} rows={documentRows} />
        <View style={{ height: 9 }} />

        <Bordered>
          <YesNoRow question="Have you ever been convicted of a criminal offence?" checked={f.everConvicted} />
          <Line label="If Yes, please give details" value={f.everConvicted === "Yes" ? f.everConvictedDetails : ""} bold={false} />
        </Bordered>
        <Bordered>
          <YesNoRow question="Have you ever required medical treatment or counseling for drug or alcohol abuse?" checked={f.drugAlcoholTreatment} />
          <Line label="If Yes, please give details" value={f.drugAlcoholTreatment === "Yes" ? f.drugAlcoholDetails : ""} bold={false} />
        </Bordered>
        <Bordered style={{ marginBottom: 0 }}>
          <YesNoRow question="Have you any pre-existing medical condition / illness?" checked={f.preExistingConditions} />
          <YesNoRow question="Do you suffer from any physical defect or partial disability?" checked={f.physicalDefect} />
          <Line label="If Yes, please give details" value={[f.preExistingDetails, f.physicalDefectDetails].filter(Boolean).join(" / ")} bold={false} />
        </Bordered>
      </RuledFrame>
      <Text style={styles.footer}>Page 2 of 5</Text>
    </Page>
  );
}

function ContactBlock({ title, row, showCompany }: { title: string; row: { firstName?: string; middleName?: string; familyName?: string; name?: string; address: string; companyName?: string; relationship: string; residenceTel: string; mobileTel: string }; showCompany: boolean }) {
  const first = row.firstName ?? row.name ?? "";
  const middle = row.middleName ?? "";
  const family = row.familyName ?? "";
  return (
    <Bordered>
      <View style={{ flexDirection: "row", marginBottom: 4 }}>
        <Text style={{ width: 88, fontWeight: 700 }}>{title}</Text>
        <Text style={{ width: 44 }}>Name</Text>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row" }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={{ borderBottom: `0.75pt solid ${B}`, minHeight: 14, fontWeight: 700 }}>{first}</Text>
              <Text style={styles.caption}>First</Text>
            </View>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={{ borderBottom: `0.75pt solid ${B}`, minHeight: 14, fontWeight: 700 }}>{middle}</Text>
              <Text style={styles.caption}>Middle</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ borderBottom: `0.75pt solid ${B}`, minHeight: 14, fontWeight: 700 }}>{family}</Text>
              <Text style={styles.caption}>Family / Surname</Text>
            </View>
          </View>
        </View>
      </View>
      <View style={{ flexDirection: "row", marginBottom: 3 }}>
        <Text style={{ width: 88 }}>Address</Text>
        <Text style={{ flex: 1, borderBottom: `0.75pt solid ${B}`, minHeight: 14, fontWeight: 700 }}>{row.address || ""}</Text>
      </View>
      {showCompany && (
        <View style={{ flexDirection: "row", marginBottom: 3 }}>
          <Text style={{ width: 88 }} />
          <Text style={{ marginRight: 5 }}>Company Name :</Text>
          <Text style={{ flex: 1, borderBottom: `0.75pt solid ${B}`, minHeight: 14, fontWeight: 700 }}>{row.companyName || ""}</Text>
        </View>
      )}
      <View style={{ flexDirection: "row", marginBottom: 3 }}>
        <Text style={{ width: 88 }} />
        <Text style={{ marginRight: 5 }}>Relationship</Text>
        <Text style={{ flex: 1, borderBottom: `0.75pt solid ${B}`, minHeight: 14, fontWeight: 700 }}>{row.relationship || ""}</Text>
      </View>
      <View style={{ flexDirection: "row", marginBottom: 3 }}>
        <Text style={{ width: 88 }} />
        <Text style={{ marginRight: 5 }}>Residence Tel.</Text>
        <Text style={{ flex: 1, borderBottom: `0.75pt solid ${B}`, minHeight: 14, fontWeight: 700 }}>{row.residenceTel || ""}</Text>
      </View>
      <View style={{ flexDirection: "row" }}>
        <Text style={{ width: 88 }} />
        <Text style={{ marginRight: 5 }}>Mobile Tel.</Text>
        <Text style={{ flex: 1, borderBottom: `0.75pt solid ${B}`, minHeight: 14, fontWeight: 700 }}>{row.mobileTel || ""}</Text>
      </View>
    </Bordered>
  );
}

function ApplicationFormPage3({ data }: { data: ApplicationFormPdfData }) {
  const { formData: f, appFormData: af, references, education, professionalQualifications, languages } = data;
  return (
    <Page size="A4" style={styles.page}>
      <RuledFrame thin={0.75} gap={3} thick={1.4} contentStyle={{ padding: 13 }}>
        <Text style={{ fontSize: 10, fontWeight: 700, marginBottom: 9 }}>Please provide names of two persons known you but not relatives.</Text>
        {references.map((r, i) => (
          <ContactBlock key={i} title="Contact details" row={r} showCompany />
        ))}
        <ContactBlock
          title="Emergency contact details"
          row={{ name: f.emergencyName, address: af.emergencyAddress, relationship: f.emergencyRelationship, residenceTel: af.emergencyResidenceTel, mobileTel: f.emergencyMobile }}
          showCompany={false}
        />

        <Text style={styles.boxTitle}>Education &amp; Qualifications</Text>
        <View style={{ marginBottom: 12 }}>
          <Table
            headers={["Name of Institute/Board", "Examination passed", "Specification", "Year Passed", "Percentage/Grade"]}
            widths={[1.4, 1.2, 1, 0.8, 1]}
            rows={education.map((e) => [e.institute, e.exam, "", e.year, e.percentage])}
          />
        </View>

        <Text style={styles.boxTitle}>Professional Qualifications</Text>
        <View style={{ marginBottom: 12 }}>
          <Table
            headers={["Name of Institute/Board", "Examination passed", "Specification", "Year Passed", "Percentage/Grade"]}
            widths={[1.4, 1.2, 1, 0.8, 1]}
            rows={professionalQualifications.map((e) => [e.institute, e.exam, "", e.year, e.percentage])}
          />
        </View>

        <Text style={styles.boxTitle}>Please indicate competency in languages [ B = basic, I = intermediate, F = fluent ]</Text>
        <Table
          headers={["Language", "Read", "Write", "Speak"]}
          widths={[1.6, 1, 1, 1]}
          rows={languages.map((l) => [l.language, l.read, l.write, l.speak])}
        />
      </RuledFrame>
      <Text style={styles.footer}>Page 3 of 5</Text>
    </Page>
  );
}

function ApplicationFormPage4({ data }: { data: ApplicationFormPdfData }) {
  const { employment, appFormData: af } = data;
  return (
    <Page size="A4" style={styles.page}>
      <RuledFrame thin={0.75} gap={3} thick={1.4} contentStyle={{ padding: 13 }}>
        <Text style={styles.boxTitle}>Employment History ( Start with your current / last employer )</Text>
        <View style={{ marginBottom: 6 }}>
          <Table
            headers={["Name and City of Employer", "From (MM/YY)", "To (MM/YY)", "Position held", "Dept.", "Last CTC"]}
            widths={[1.6, 0.8, 0.8, 1, 0.8, 0.9]}
            rows={employment.map((e) => [e.employer, e.from, e.to, e.role, "", e.lastCTC])}
          />
        </View>
        <Line label="Reason for leaving last position" value="" bold={false} />

        <Text style={styles.boxTitle}>Draw an organization chart and locate your current position in it.</Text>
        <Bordered style={{ marginBottom: 12 }} contentStyle={{ minHeight: 188, padding: 0 }} />

        <Bordered>
          <Text style={{ fontWeight: 700, marginBottom: 4 }}>Please list any interest in sports and/or other hobbies ?</Text>
          <RuledBlock value={af.hobbies} lines={3} />
        </Bordered>

        <Bordered>
          <Text style={{ fontWeight: 700, marginBottom: 4 }}>Did you have any operation in recent past? If yes please specify.</Text>
          <RuledBlock value={af.recentOperation === "Yes" ? af.recentOperationDetails : af.recentOperation} lines={3} />
        </Bordered>

        <Bordered style={{ marginBottom: 0 }}>
          <Text style={{ fontWeight: 700, marginBottom: 4 }}>Do you have any significant achievement in the course of your career?</Text>
          <RuledBlock value={af.achievement} lines={3} />
        </Bordered>
      </RuledFrame>
      <Text style={styles.footer}>Page 4 of 5</Text>
    </Page>
  );
}

function ApplicationFormPage5({ data }: { data: ApplicationFormPdfData }) {
  const { formData: f, appFormData: af, enclosures } = data;
  return (
    <Page size="A4" style={styles.page}>
      <RuledFrame thin={0.75} gap={3} thick={1.4} contentStyle={{ padding: 13 }}>
        <Bordered>
          <Text style={{ fontWeight: 700, marginBottom: 4 }}>Write a few words on your career objective?</Text>
          <RuledBlock value={f.careerObjective} lines={3} />
        </Bordered>

        <Bordered>
          <Text style={{ fontWeight: 700, marginBottom: 4 }}>What are your Strengths and Areas of Improvement? Please mention 3 points.</Text>
          <RuledBlock value={af.strengths} lines={4} />
        </Bordered>

        <Bordered>
          <Text style={{ fontWeight: 700, marginBottom: 4 }}>Why do you consider yourself suitable for this position?</Text>
          <RuledBlock value={af.suitability} lines={4} />
        </Bordered>

        <Bordered>
          <Text style={{ fontWeight: 700, marginBottom: 4 }}>Is any of your relative or acquaintance working in this company?</Text>
          <Text style={{ fontSize: 7.5, color: MUTED, marginBottom: 4 }}>(If Yes, Please mention his/her details)</Text>
          <RuledBlock value={af.relativeInCompany === "Yes" ? af.relativeInCompanyDetails : af.relativeInCompany} lines={3} />
        </Bordered>

        <Text style={styles.boxTitle}>Declaration</Text>
        <Bordered>
          <Text style={{ marginBottom: 12 }}>I agree that my employment is subject to verification of the statements made by me in this form.</Text>
          <View style={{ flexDirection: "row" }}>
            <Line label="Dated" value={f.declarationDate} />
            <View style={{ width: 20 }} />
            <Line label="Signed" value="" />
          </View>
        </Bordered>

        <Text style={styles.boxTitle}>Enclosed Herewith</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {enclosures.length === 0 ? (
            <Text style={{ color: MUTED }}>None selected.</Text>
          ) : (
            enclosures.map((item) => (
              <View key={item} style={{ width: "33%", flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8, paddingRight: 10 }}>
                <Text>{item}</Text>
                <CBox checked />
              </View>
            ))
          )}
        </View>
      </RuledFrame>
      <Text style={styles.footer}>Page 5 of 5</Text>
    </Page>
  );
}

export function ApplicationFormPdfDocument({ data }: { data: ApplicationFormPdfData }) {
  return (
    <Document>
      <ApplicationFormPage1 data={data} />
      <ApplicationFormPage2 data={data} />
      <ApplicationFormPage3 data={data} />
      <ApplicationFormPage4 data={data} />
      <ApplicationFormPage5 data={data} />
    </Document>
  );
}
