import { Document, Page, View, Text, Image, Svg, Polyline, StyleSheet } from "@react-pdf/renderer";

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
  return "MSK Private Limited";
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
  // Prints on the "Divisional Head" signature block in place of that static
  // label — entered at creation, not tied to any actual approval record.
  approvalSignatureName?: string | null;
  approvalSignatureDesignation?: string | null;
  approvalRecords: { level: string; approverName: string; recordedAt: string; status: string }[];
}

const INK = "#1f2937";
const MUTED = "#6b7280";
const RULE = "#9ca3af";
const ACCENT = "#1e3a5f";

const styles = StyleSheet.create({
  page: { padding: 26, paddingTop: 20, fontSize: 9, fontFamily: "Helvetica", color: INK, border: `1pt solid ${RULE}` },
  header: { alignItems: "center", marginBottom: 8, paddingBottom: 8, borderBottom: `1.5pt solid ${ACCENT}` },
  logo: { width: 130, height: 42, objectFit: "contain", marginBottom: 4 },
  // PSPL's logo has a wider landscape aspect ratio than the shared box —
  // give it its own slightly larger box matching its proportions instead
  // of squeezing it down to fit.
  logoPspl: { width: 115, height: 67, objectFit: "contain", marginBottom: 4 },
  companyName: { fontSize: 12, fontWeight: 700, color: ACCENT },
  formTitle: { fontSize: 13, fontWeight: 700, marginTop: 4, letterSpacing: 0.5 },
  topRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8, fontSize: 9, color: MUTED },

  sectionHeader: {
    fontSize: 9.5,
    fontWeight: 700,
    color: INK,
    backgroundColor: "#e5e7eb",
    paddingVertical: 2,
    paddingHorizontal: 6,
    marginTop: 7,
    marginBottom: 4,
  },

  row: { flexDirection: "row", marginBottom: 5, alignItems: "flex-end" },
  spaceBetween: { justifyContent: "space-between" },
  field: { flexDirection: "row", flex: 1, alignItems: "flex-end" },
  label: { marginRight: 4, color: MUTED },
  rowLabel: { color: MUTED },
  value: { flex: 1, borderBottom: `0.75pt solid ${RULE}`, paddingBottom: 2, minHeight: 12, color: "#111827", fontWeight: 600 },
  valueTall: { flex: 1, borderBottom: `0.75pt solid ${RULE}`, paddingBottom: 2, minHeight: 22, color: "#111827", fontWeight: 600 },
  valueBlankLine: { flex: 1, borderBottom: `0.75pt solid ${RULE}`, minHeight: 12 },

  checkboxGroup: { flexDirection: "row", alignItems: "center" },
  checkboxRow: { flexDirection: "row", alignItems: "center", marginLeft: 16 },
  checkbox: {
    width: 12,
    height: 12,
    borderRadius: 2,
    border: `1.2pt solid ${ACCENT}`,
    backgroundColor: "#fff",
    marginLeft: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: ACCENT },
  checkboxLabel: { color: INK },

  sentenceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
    paddingBottom: 3,
    borderBottom: `0.5pt solid #e5e7eb`,
  },
  sentenceText: { flex: 1, paddingRight: 12, color: INK },

  divider: { borderBottom: `0.75pt solid ${RULE}`, marginVertical: 7 },
  sigBlock: { flex: 1, marginRight: 16 },
  sigHead: { fontSize: 9, fontWeight: 700, color: MUTED, marginBottom: 10 },
  // marginTop is blank room for an actual pen signature above the line —
  // deliberately generous, unlike the tighter spacing used elsewhere on the page.
  sigLine: { borderTop: `0.75pt solid ${INK}`, marginTop: 16, paddingTop: 3, fontSize: 8.5 },

  footer: { marginTop: 10, fontSize: 7.5, color: MUTED, textAlign: "center" },
});

// labelWidth pins the label column to a fixed width so that stacked rows in
// the same section (e.g. Age / Work experience on the left, Qualification /
// Preferred / Industry background on the right) line their underlines up
// instead of each starting wherever its own label text happens to end.
function Field({ label, value, flex = 1, labelWidth, valueStyle }: { label: string; value: string; flex?: number; labelWidth?: number; valueStyle?: typeof styles.value }) {
  return (
    <View style={[styles.field, { flex }]}>
      <Text style={labelWidth ? [styles.label, { width: labelWidth }] : styles.label}>{label}:</Text>
      <Text style={valueStyle || styles.value}>{value || ""}</Text>
    </View>
  );
}

// Drawn as an SVG path rather than a text glyph — the base Helvetica font's
// WinAnsi encoding has no checkmark character, so a "✓" text glyph would
// render blank/missing in most PDF viewers.
function Tick() {
  return (
    <Svg width={8} height={8} viewBox="0 0 12 12">
      <Polyline points="2,6.5 5,9.5 10,2.5" stroke="#fff" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Compact label+box pair, used for grouped short options (Y/N, a/b) — the
// box sits to the right of its own label, and groups of these are placed at
// the right edge of the row by the parent's space-between layout.
function Checkbox({ label, checked }: { label: string; checked: boolean }) {
  return (
    <View style={styles.checkboxRow}>
      <Text style={styles.checkboxLabel}>{label}</Text>
      <View style={checked ? [styles.checkbox, styles.checkboxChecked] : styles.checkbox}>
        {!!checked && <Tick />}
      </View>
    </View>
  );
}

// A full sentence on the left with a single checkbox docked at the row's
// right edge.
function SentenceCheckbox({ text, checked }: { text: string; checked: boolean }) {
  return (
    <View style={styles.sentenceRow}>
      <Text style={styles.sentenceText}>{text}</Text>
      <View style={checked ? [styles.checkbox, styles.checkboxChecked] : styles.checkbox}>
        {!!checked && <Tick />}
      </View>
    </View>
  );
}

export function MRFPdfDocument({ mrf }: { mrf: MRFPdfData }) {
  const rootOrgName = mrf.orgUnit?.path?.split(" / ")[0] || mrf.orgUnit?.name || "";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Image src={getLogoSrc(rootOrgName)} style={rootOrgName === "PSPL" ? styles.logoPspl : styles.logo} />
          <Text style={styles.companyName}>{getCompanyName(rootOrgName)}</Text>
          <Text style={styles.formTitle}>MANPOWER REQUISITION FORM</Text>
        </View>

        <View style={styles.topRow}>
          <Text>{mrf.mrfNumber ? `MRF No: ${mrf.mrfNumber}` : `Ref: ${mrf.referenceNumber}`}</Text>
          <Text>Date: {new Date(mrf.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</Text>
        </View>

        <View style={styles.row}>
          <Field label="Branch/ Function/ Division" value={mrf.department.name} flex={1} />
          <Field label="Division" value={mrf.orgUnit?.path || ""} flex={1} />
        </View>

        <View style={[styles.row, styles.spaceBetween]}>
          <Text style={styles.rowLabel}>The vacancy is</Text>
          <View style={styles.checkboxGroup}>
            <Checkbox label="a) Replacement" checked={mrf.vacancyType === "REPLACEMENT"} />
            <Checkbox label="b) New Position" checked={mrf.vacancyType === "NEW_POSITION"} />
          </View>
        </View>

        {/* Both sections print unconditionally, like the paper template —
            the checkboxes above/within indicate which one actually applies,
            rather than hiding the section that doesn't. */}
        <View style={styles.row}>
          <Text>
            (For {mrf.replacementFor || "_____________"})    ({formatReplacementReason(mrf.replacementReason)})
          </Text>
        </View>
        <Text style={{ marginBottom: 4, color: MUTED }}>
          If replacement: Name of the resigned Employee with CTC, State the reason why replacement is necessary:
        </Text>
        <View style={styles.row}>
          <Text style={styles.value}>
            {mrf.replacedEmployeeName || ""}{mrf.replacedEmployeeCTC ? ` — CTC: ${mrf.replacedEmployeeCTC}` : ""}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.value}>{mrf.replacementNecessityReason || ""}</Text>
        </View>

        <SentenceCheckbox
          text="If new position: New role in terms of new responsibilities/ new skills has been identified"
          checked={mrf.isNewRole}
        />
        <SentenceCheckbox
          text="Business expansion (the quantum/ volume of work has increased)"
          checked={mrf.isBusinessExpansion}
        />
        <View style={styles.row}>
          <Field label="Substantiate with suitable justification" value={mrf.newRoleJustification || ""} />
        </View>

        <Text style={styles.sectionHeader}>POSITION DETAILS</Text>

        <View style={[styles.row, styles.spaceBetween]}>
          <Text style={styles.rowLabel}>Budgeted for</Text>
          <View style={styles.checkboxGroup}>
            <Checkbox label="Y" checked={mrf.isBudgeted === true} />
            <Checkbox label="N" checked={mrf.isBudgeted === false} />
          </View>
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
          <Field label="Reporting to" value={mrf.reportingTo || ""} flex={1} />
          <Field label="Subordinates" value="" flex={1} />
        </View>
        <View style={styles.row}>
          <Field label="Job profile (attach detailed JD for new positions)" value={mrf.jobProfile || ""} valueStyle={styles.valueTall} />
        </View>
        <View style={styles.row}>
          <Text style={styles.valueBlankLine}> </Text>
        </View>
        <View style={styles.row}>
          <Field label="No. required" value={String(mrf.vacancyCount)} flex={1} />
          <Field label="Position to be filled latest (by date)" value="" flex={1} />
        </View>

        <Text style={styles.sectionHeader}>SPECIFICATIONS</Text>

        <View style={styles.row}>
          <Field label="Age" value={mrf.minAge || mrf.maxAge ? `${mrf.minAge ?? "—"} - ${mrf.maxAge ?? "—"}` : ""} flex={1} labelWidth={95} />
          <Field label="Qualification (minimum)" value={mrf.minQualification || ""} flex={1} labelWidth={130} />
        </View>
        <View style={styles.row}>
          <Field label="Work experience" value={mrf.workExperience || ""} flex={1} labelWidth={95} />
          <Field label="Preferred" value={mrf.preferredQualification || ""} flex={1} labelWidth={130} />
        </View>
        <View style={styles.row}>
          <Field label="Industry background" value={mrf.industryBackground || ""} flex={1} labelWidth={95} />
        </View>
        <View style={styles.row}>
          <Field label="Any other" value={mrf.otherSpecs || ""} labelWidth={95} />
        </View>

        <SentenceCheckbox
          text="# The contribution expected from the new position justifies the additional cost incurred"
          checked={mrf.contributionJustified === true}
        />

        <View style={styles.divider} />

        <View style={styles.row}>
          <Text style={[styles.sigHead, { flex: 1 }]}>Branch/ Departmental Head</Text>
          <Text style={[styles.sigHead, { flex: 1 }]}>{mrf.approvalSignatureDesignation || "Divisional Head"}</Text>
        </View>
        <View style={styles.row}>
          <View style={styles.sigBlock}>
            <Text style={styles.sigLine}>{fillerLine(mrf.fillerName, mrf.fillerDesignation)}</Text>
          </View>
          <View style={styles.sigBlock}>
            <Text style={styles.sigLine}>{mrf.approvalSignatureName || " "}</Text>
          </View>
        </View>

        <View style={[styles.row, styles.spaceBetween, { marginTop: 18, alignItems: "flex-start" }]}>
          <View style={[styles.checkboxGroup, { marginTop: 14 }]}>
            <Text style={styles.rowLabel}>Sanctioned</Text>
            <Checkbox label="Y" checked={mrf.status === "APPROVED"} />
            <Checkbox label="N" checked={mrf.status === "REJECTED"} />
          </View>
          <View style={{ flex: 1, marginLeft: 20 }}>
            <Text style={styles.sigLine}> </Text>
            <Text style={[styles.sigHead, { marginTop: 3, marginBottom: 0 }]}>Managing Director</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          {mrf.fillerName ? `Raised by: ${fillerLine(mrf.fillerName, mrf.fillerDesignation)}  |  ` : ""}
          This is a system-generated document — {mrf.referenceNumber}
        </Text>
      </Page>
    </Document>
  );
}

function formatReplacementReason(reason?: string | null) {
  if (!reason) return "Resignation/ Transfer/ Retirement";
  return reason.charAt(0) + reason.slice(1).toLowerCase();
}

function fillerLine(name?: string | null, designation?: string | null) {
  if (!name) return " ";
  return designation ? `${name} — ${designation}` : name;
}
