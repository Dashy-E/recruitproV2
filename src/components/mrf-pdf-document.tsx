import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";

// Each top-level org unit (Corporate / India / PSPL / Gemini / Overseas)
// prints under its own letterhead — PSPL and Gemini are their own legal
// entities with their own logo; everything else falls under the MSK banner.
function getLogoSrc(rootOrgName: string): string {
  if (rootOrgName === "PSPL") return "/logos/PRIMAWAVE4_TRANS.png";
  if (rootOrgName === "Gemini") return "/logos/Gemini.png";
  return "/logos/msklogo.jpg";
}

function getCompanyName(rootOrgName: string): string {
  if (rootOrgName === "PSPL") return "Primawave Software Pvt. Ltd.";
  if (rootOrgName === "Gemini") return "Gemini Sampling Solution Private Limited";
  return "Mitra SK Private Limited";
}

// Field mapping is grounded in this app's actual 3-stage approval chain
// (Divisional -> Functional -> Country), which is the closest equivalent to
// the paper form's Branch/Departmental Head -> Divisional Head -> Managing
// Director sign-off chain. Signature lines are left blank for physical
// signing; only the printed name + date of who already approved digitally is
// shown above each line.
export interface MRFPdfData {
  referenceNumber: string;
  mrfNumber: string | null;
  title: string;
  status: string;
  vacancyCount: number;
  ctcRange: string | null;
  location: string | null;
  reportingTo: string | null;
  jobProfile: string | null;
  vacancyType: string | null;
  replacedEmployeeName: string | null;
  replacedEmployeeCTC: string | null;
  replacementFor: string | null;
  replacementReason: string | null;
  replacementNecessityReason?: string | null;
  isNewRole: boolean;
  isBusinessExpansion: boolean;
  newRoleJustification: string | null;
  isBudgeted: boolean | null;
  proposedGrade: string | null;
  minAge: number | null;
  maxAge: number | null;
  minQualification: string | null;
  preferredQualification: string | null;
  workExperience: string | null;
  industryBackground: string | null;
  otherSpecs: string | null;
  contributionJustified: boolean;
  createdAt: string;
  orgUnit: { name: string; path: string } | null;
  department: { name: string };
  designation: { title: string } | null;
  fillerName?: string | null;
  fillerDesignation?: string | null;
  approvalRecords: { level: string; approverName: string; recordedAt: string; status: string }[];
}

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica", color: "#111" },
  header: { alignItems: "center", marginBottom: 12 },
  logo: { width: 140, height: 46, objectFit: "contain", marginBottom: 4 },
  companyName: { fontSize: 12, fontWeight: 700 },
  formTitle: { fontSize: 11, fontWeight: 700, marginTop: 2 },
  topRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  row: { flexDirection: "row", marginBottom: 6, alignItems: "flex-end" },
  field: { flexDirection: "row", flex: 1, alignItems: "flex-end" },
  label: { marginRight: 4 },
  value: { flex: 1, borderBottom: "1pt solid #333", paddingBottom: 1, minHeight: 11 },
  section: { marginTop: 8, marginBottom: 4 },
  checkboxRow: { flexDirection: "row", alignItems: "center", marginRight: 16 },
  checkbox: { width: 9, height: 9, border: "1pt solid #333", marginRight: 4, alignItems: "center", justifyContent: "center" },
  checkboxMark: { fontSize: 8, fontWeight: 700 },
  divider: { borderBottom: "1pt solid #999", marginVertical: 8 },
  sigBlock: { flex: 1, marginRight: 16 },
  sigLine: { borderTop: "1pt solid #333", marginTop: 20, paddingTop: 2 },
});

function Field({ label, value, flex = 1 }: { label: string; value: string; flex?: number }) {
  return (
    <View style={[styles.field, { flex }]}>
      <Text style={styles.label}>{label}:</Text>
      <Text style={styles.value}>{value || ""}</Text>
    </View>
  );
}

function Checkbox({ label, checked }: { label: string; checked: boolean }) {
  return (
    <View style={styles.checkboxRow}>
      <View style={styles.checkbox}>{checked && <Text style={styles.checkboxMark}>X</Text>}</View>
      <Text>{label}</Text>
    </View>
  );
}

function findApprover(records: MRFPdfData["approvalRecords"], level: string) {
  return records.find((r) => r.level === level && r.status === "APPROVED");
}

export function MRFPdfDocument({ mrf }: { mrf: MRFPdfData }) {
  const rootOrgName = mrf.orgUnit?.path?.split(" / ")[0] || mrf.orgUnit?.name || "";
  const divisionalApprover = findApprover(mrf.approvalRecords, "DIVISIONAL_MANAGER");
  const functionalApprover = findApprover(mrf.approvalRecords, "FUNCTIONAL_HEAD");
  const countryApprover = findApprover(mrf.approvalRecords, "COUNTRY_MANAGER");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Image src={getLogoSrc(rootOrgName)} style={styles.logo} />
          <Text style={styles.companyName}>{getCompanyName(rootOrgName)}</Text>
          <Text style={styles.formTitle}>MANPOWER REQUISITION FORM</Text>
        </View>

        <View style={styles.topRow}>
          <Text>Ref: {mrf.referenceNumber}{mrf.mrfNumber ? `   MRF No: ${mrf.mrfNumber}` : ""}</Text>
          <Text>Date: {new Date(mrf.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</Text>
        </View>

        <View style={styles.row}>
          <Field label="Division" value={mrf.orgUnit?.path || ""} />
        </View>
        <View style={styles.row}>
          <Field label="Branch / Function / Department" value={mrf.department.name} />
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>The vacancy is:</Text>
          <Checkbox label="a) Replacement" checked={mrf.vacancyType === "REPLACEMENT"} />
          <Checkbox label="b) New Position" checked={mrf.vacancyType === "NEW_POSITION"} />
        </View>

        {mrf.vacancyType === "REPLACEMENT" && (
          <>
            <View style={styles.row}>
              <Field label="For" value={mrf.replacementFor || ""} flex={1} />
              <Field label="Reason" value={mrf.replacementReason || ""} flex={1} />
            </View>
            <View style={styles.row}>
              <Field label="Name of resigned employee" value={mrf.replacedEmployeeName || ""} flex={1} />
              <Field label="CTC of replaced employee" value={mrf.replacedEmployeeCTC || ""} flex={1} />
            </View>
            <View style={styles.row}>
              <Field label="Reason replacement is necessary" value={mrf.replacementNecessityReason || ""} />
            </View>
          </>
        )}

        {mrf.vacancyType === "NEW_POSITION" && (
          <>
            <View style={styles.row}>
              <Checkbox label="New role (new responsibilities / skills identified)" checked={mrf.isNewRole} />
              <Checkbox label="Business expansion (volume of work increased)" checked={mrf.isBusinessExpansion} />
            </View>
            <View style={styles.row}>
              <Field label="Justification" value={mrf.newRoleJustification || ""} />
            </View>
          </>
        )}

        <View style={styles.row}>
          <Text style={styles.label}>Budgeted for:</Text>
          <Checkbox label="Y" checked={mrf.isBudgeted === true} />
          <Checkbox label="N" checked={mrf.isBudgeted === false} />
        </View>

        <View style={styles.row}>
          <Field label="Proposed designation" value={mrf.designation?.title || ""} flex={2} />
          <Field label="Grade" value={mrf.proposedGrade || ""} flex={1} />
        </View>
        <View style={styles.row}>
          <Field label="CTC Range" value={mrf.ctcRange || ""} flex={1} />
          <Field label="Location" value={mrf.location || ""} flex={1} />
        </View>
        <View style={styles.row}>
          <Field label="Reporting to" value={mrf.reportingTo || ""} />
        </View>
        <View style={styles.row}>
          <Field label="Job profile (attach detailed JD for new positions)" value={mrf.jobProfile || ""} />
        </View>

        <View style={styles.row}>
          <Field label="No. required" value={String(mrf.vacancyCount)} flex={1} />
        </View>

        <Text style={{ fontWeight: 700, marginTop: 4 }}>Specifications</Text>
        <View style={styles.row}>
          <Field label="Qualification (minimum)" value={mrf.minQualification || ""} flex={1} />
          <Field label="Preferred" value={mrf.preferredQualification || ""} flex={1} />
        </View>
        <View style={styles.row}>
          <Field label="Age" value={mrf.minAge || mrf.maxAge ? `${mrf.minAge ?? "—"} - ${mrf.maxAge ?? "—"}` : ""} flex={1} />
        </View>
        <View style={styles.row}>
          <Field label="Work experience" value={mrf.workExperience || ""} flex={1} />
          <Field label="Industry background" value={mrf.industryBackground || ""} flex={1} />
        </View>
        <View style={styles.row}>
          <Field label="Any other" value={mrf.otherSpecs || ""} />
        </View>

        <View style={styles.row}>
          <Text style={styles.label}># The contribution expected from the new position justifies the additional cost incurred:</Text>
          <Checkbox label="Y" checked={mrf.contributionJustified === true} />
          <Checkbox label="N" checked={mrf.contributionJustified === false} />
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={styles.sigBlock}>
            <Text>{fillerLine(mrf.fillerName, mrf.fillerDesignation)}</Text>
            <Text style={styles.sigLine}>Designation and Signature (Raised By)</Text>
          </View>
        </View>

        <View style={[styles.row, { marginTop: 16 }]}>
          <View style={styles.sigBlock}>
            <Text>{approverLine(functionalApprover)}</Text>
            <Text style={styles.sigLine}>Branch / Departmental Head</Text>
          </View>
          <View style={styles.sigBlock}>
            <Text>{approverLine(divisionalApprover)}</Text>
            <Text style={styles.sigLine}>Divisional Head</Text>
          </View>
        </View>

        <View style={[styles.row, { marginTop: 16 }]}>
          <Text style={styles.label}>Sanctioned:</Text>
          <Checkbox label="Y" checked={mrf.status === "APPROVED"} />
          <Checkbox label="N" checked={mrf.status === "REJECTED"} />
          <View style={[styles.sigBlock, { marginLeft: 16 }]}>
            <Text>{approverLine(countryApprover)}</Text>
            <Text style={styles.sigLine}>Managing Director (Date)</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

function fillerLine(name?: string | null, designation?: string | null) {
  if (!name) return " ";
  return designation ? `${name} — ${designation}` : name;
}

function approverLine(record?: { approverName: string; recordedAt: string }) {
  if (!record) return " ";
  const date = new Date(record.recordedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  return `${record.approverName} — ${date}`;
}
