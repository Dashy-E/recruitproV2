import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { FormData, StatutoryFormsData } from "@/app/dashboard/employee-portal/page";

// Verbatim replica of "Declaration of Confidentiality and Impartiality.pdf"
// (Doc. No. MSK/GEN/17/02) — a plain letter, not a boxed form, so this
// deliberately has no borders/boxes, matching the source. The blank ("I,
// ______,") is filled with the employee's name; Name/Date/Designation at
// the bottom are filled in rather than left blank since this copy is
// generated with the employee's own data already known.
export interface ConfidentialityDeclarationPdfData {
  employeeCode: string;
  department: string | null;
  designation: string | null;
  formData: FormData;
  statutoryData: StatutoryFormsData;
}

const INK = "#000";

const styles = StyleSheet.create({
  page: { padding: 48, paddingTop: 40, fontSize: 10, fontFamily: "Helvetica", color: INK, lineHeight: 1.4 },
  docNo: { textAlign: "right", fontSize: 9, marginBottom: 28 },
  title: { fontSize: 12, fontWeight: 700, textDecoration: "underline", textAlign: "center", marginBottom: 20 },
  para: { marginBottom: 12, textAlign: "justify" },
  itemRow: { flexDirection: "row", marginBottom: 10 },
  itemNum: { width: 20 },
  itemText: { flex: 1, textAlign: "justify" },
  bold: { fontWeight: 700 },
});

function Item({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <View style={styles.itemRow}>
      <Text style={styles.itemNum}>{n}.</Text>
      <Text style={styles.itemText}>{children}</Text>
    </View>
  );
}

export function ConfidentialityDeclarationPdfDocument({ data }: { data: ConfidentialityDeclarationPdfData }) {
  const { formData: f, statutoryData: s } = data;
  const name = [f.firstName, f.middleName, f.lastName].filter(Boolean).join(" ");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.docNo}>Doc. No. : MSK/GEN/17/02</Text>
        <Text style={styles.title}>Declaration of Confidentiality And Impartiality</Text>

        <Text style={styles.para}>
          I, <Text style={styles.bold}>{name || "____________________"}</Text>, an employee of Mitra S. K. Private Limited (MSK), do hereby pledge and
          confirm to comply with the instructions noted below to maintain confidentiality and Impartiality.
        </Text>

        <Item n={1}>
          All information and documents provided by MSK shall be treated by me as strictly confidential and
          shall not be divulged to any other person or entity who are not authorized to receive such
          information or documents.
        </Item>
        <Item n={2}>
          During the process of inspection, analysis or other allied works, I shall not allow the presence of
          any other person who are not authorized by MSK. Any deviation shall be immediately brought to
          the notice of the Branch Manager / Divisional Manager / HOD or his nominated deputy in his / her
          absence.
        </Item>
        <Item n={3}>
          During inspection/ field work or analysis, I shall be free from any undue internal and external
          commercial, financial and other pressure and shall not be influenced in any way to come to a
          particular conclusion regarding the results of the inspection or analysis.
        </Item>
        <Item n={4}>
          I shall remain truthful, unbiased and impartial in discharging my services.
        </Item>
        <Item n={5}>
          The sample or any part of it shall not be handed over to any third party unless specifically instructed
          by MSK.
        </Item>
        <Item n={6}>
          I shall not have any present relationship with any other agencies (Third party Inspection Agency) or
          client even if I may have worked with them in the past. My past relationship with any other
          agencies (Third Party Inspection Agency) or client with whom I may have worked in the past will
          not pose a threat to the impartiality, confidentiality and integrity of MSK.
        </Item>
        <Item n={7}>
          I shall neither copy any documentation nor divulge any information to any third party without the
          prior written consent of MSK.
        </Item>
        <Item n={8}>
          I shall not act in any way prejudicial to the reputation or interest of MSK or its clients.
        </Item>

        <Text style={styles.para}>
          In the event of any breach of this undertaking, I shall cooperate fully in any enquiry/investigation to be
          conducted to this effect.
        </Text>

        <Text style={{ marginTop: 16, marginBottom: 24 }}>Yours Faithfully</Text>

        <View style={{ flexDirection: "row", marginBottom: 6 }}>
          <Text>Name: {name}</Text>
          <Text style={{ marginLeft: 40 }}>Date: {s.confidentialityDate || ""}</Text>
        </View>
        <Text>Designation: {data.designation || ""}</Text>
      </Page>
    </Document>
  );
}
