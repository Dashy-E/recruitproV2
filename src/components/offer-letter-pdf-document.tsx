import { Document, Page, View, Text, StyleSheet, Font } from "@react-pdf/renderer";

// Calibri itself isn't one of react-pdf's built-in fonts (Helvetica/Times/
// Courier only), and it's a Microsoft-licensed font we can't freely bundle
// and serve from this app. Carlito (SIL Open Font License, via
// @fontsource/carlito) is metrics-compatible with Calibri — same letter
// widths/spacing — so it's a safe drop-in look-alike. Files live in
// public/fonts/carlito/ so the browser-rendered PDF viewer can fetch them.
Font.register({
  family: "Carlito",
  fonts: [
    { src: "/fonts/carlito/carlito-regular.woff", fontWeight: "normal" },
    { src: "/fonts/carlito/carlito-bold.woff", fontWeight: "bold" },
    { src: "/fonts/carlito/carlito-italic.woff", fontStyle: "italic", fontWeight: "normal" },
    { src: "/fonts/carlito/carlito-bolditalic.woff", fontStyle: "italic", fontWeight: "bold" },
  ],
});

// Matches the real "Offer Letter" template supplied by the business —
// everything already captured on the candidate record (name, designation,
// grade, location, date of joining, address, ref no, recruitment entity) is
// filled in dynamically; the document checklist / closing boilerplate /
// signatory name are fixed text straight off the template. Ref. No. falls
// back to a blank line if not entered (no numbering system exists for offer
// letters).
export interface OfferLetterPdfData {
  firstName: string;
  lastName: string;
  designation: string | null;
  grade: string | null;
  location: string | null;
  dateOfJoining: string | null;
  address: string | null;
  refNo: string | null;
  recruitmentEntity: string | null;
  isFresher: boolean;
}

const INK = "#000000";

// Top/bottom padding is deliberately generous (~1.25in / ~0.85in) to leave
// blank space for a pre-printed letterhead (logo/company header, footer
// contact strip) — content prints only in the space between. Paragraph/list
// spacing is kept tight enough that the whole letter still fits on one A4
// page within that shrunk usable area.
const styles = StyleSheet.create({
  page: { paddingTop: 108, paddingBottom: 65, paddingHorizontal: 55, fontSize: 10, fontFamily: "Carlito", color: INK, lineHeight: 1.3 },
  topRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  addressBlock: { marginBottom: 12 },
  subLine: { textAlign: "center", fontWeight: 700, textDecoration: "underline", marginBottom: 8 },
  para: { marginBottom: 8, textAlign: "justify" },
  bold: { fontWeight: 700 },
  listItem: { marginBottom: 2 },
  signatureBlock: { marginTop: 28 },
});

function ordinal(day: number): string {
  if (day > 3 && day < 21) return "th";
  switch (day % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function formatOrdinalDate(date: Date, withCommaBeforeYear: boolean): string {
  const day = date.getDate();
  const month = MONTHS[date.getMonth()];
  const year = date.getFullYear();
  return withCommaBeforeYear ? `${day}${ordinal(day)} ${month},${year}` : `${day}${ordinal(day)} ${month} ${year}`;
}

// Last three checklist items and the background-check paragraph's mention of
// prior employment only make sense for candidates who've actually held a
// job before — omitted for freshers (see OfferLetterPage1).
const DOCUMENT_CHECKLIST_BASE = [
  "2 passport size photographs,",
  "Age proof",
  "Aadhaar Card",
  "Pan Card",
  "Address proof",
  "Photocopies of all mark sheets and certificates from Class X onwards",
  "Bank Details",
];
const DOCUMENT_CHECKLIST_EXPERIENCED_ONLY = [
  "Present Company Appointment Letter",
  "Last three months' salary slip",
  "Accepted Resignation Letter",
];

function OfferLetterPage1({ candidate }: { candidate: OfferLetterPdfData }) {
  const today = new Date();
  const joiningDate = candidate.dateOfJoining ? new Date(candidate.dateOfJoining) : null;
  const documentChecklist = candidate.isFresher
    ? DOCUMENT_CHECKLIST_BASE
    : [...DOCUMENT_CHECKLIST_BASE, ...DOCUMENT_CHECKLIST_EXPERIENCED_ONLY];
  const backgroundCheckParagraph = candidate.isFresher
    ? "The appointment is contingent upon satisfactory reference and background checks which may be conducted at any time which includes verification of your application materials and education qualification, which is being conducted with your consent."
    : "The appointment is contingent upon satisfactory reference and background checks which may be conducted at any time which includes verification of your application materials, education qualification and employment history your last organization, which is being conducted with your consent.";

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.topRow}>
        <Text>Ref. No. {candidate.refNo || "____________________"}</Text>
        <Text>Dated: {formatOrdinalDate(today, true)}</Text>
      </View>

      <View style={styles.addressBlock}>
        <Text>To,</Text>
        <Text>{candidate.firstName} {candidate.lastName}</Text>
        {candidate.address && <Text>{candidate.address}</Text>}
      </View>

      <Text style={styles.subLine}>Sub: Offer Letter</Text>

      <Text style={styles.para}>Dear {candidate.firstName},</Text>

      <Text style={styles.para}>
        Further to your interview and subsequent discussion with us, we are pleased to offer you the position of
        {" “"}<Text style={styles.bold}>{candidate.designation || "____________________"}</Text>{"” "}
        in Work Level {"“"}<Text style={styles.bold}>{candidate.grade || "________"}</Text>{"” "}
        in our organization. You are expected to join at <Text style={styles.bold}>{candidate.location || "____________________"}</Text> on
        {" "}or before <Text style={styles.bold}>{joiningDate ? formatOrdinalDate(joiningDate, false) : "____________________"}</Text>.
        In case you fail to join on the above mentioned date, this offer will stand cancelled.
      </Text>

      <Text style={styles.para}>{backgroundCheckParagraph}</Text>

      <Text style={styles.para}>
        You are requested to submit the following list of documents (Originals &amp; Photocopies) on your date of joining.
      </Text>

      <View style={{ marginBottom: 10 }}>
        {documentChecklist.map((item, i) => (
          <Text key={i} style={styles.listItem}>{i + 1}. {item}</Text>
        ))}
      </View>

      <Text style={styles.para}>
        Please sign and return the duplicate copy of this letter, confirming your acceptance, within 48 hours of receiving it.
      </Text>

      <Text style={styles.para}>
        In case if you accept and do not join this organization, then you have to bear an administrative charge equal
        to one month Of CTC offered to you.
      </Text>

      <Text>Thanks, and regards,</Text>
      <Text style={styles.bold}>For {candidate.recruitmentEntity || "Mitra S.K Pvt. Ltd."}</Text>

      <View style={styles.signatureBlock}>
        <Text style={styles.bold}>Ms. Rinki Bhattacharya</Text>
        <Text>Manager – HR</Text>
      </View>
    </Page>
  );
}

export function OfferLetterPdfDocument({ candidate }: { candidate: OfferLetterPdfData }) {
  return (
    <Document>
      <OfferLetterPage1 candidate={candidate} />
    </Document>
  );
}
