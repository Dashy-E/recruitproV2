"use client";
import dynamic from "next/dynamic";
import { Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MRFPdfData, MRFPdfDocument } from "@/components/mrf-pdf-document";

// @react-pdf/renderer's viewer/download components touch browser-only APIs
// (Blob, URL.createObjectURL) at render time, which breaks Next.js's
// server-side module evaluation if imported statically — ssr:false is the
// standard fix.
const PDFViewer = dynamic(() => import("@react-pdf/renderer").then((m) => m.PDFViewer), {
  ssr: false,
  loading: () => (
    <div className="flex h-[70vh] items-center justify-center text-gray-400">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  ),
});

const PDFDownloadLink = dynamic(() => import("@react-pdf/renderer").then((m) => m.PDFDownloadLink), { ssr: false });

export function MRFPdfPreview({ mrf }: { mrf: MRFPdfData }) {
  return (
    <div className="space-y-3">
      <PDFViewer style={{ width: "100%", height: "70vh", border: "1px solid #e5e7eb", borderRadius: 8 }}>
        <MRFPdfDocument mrf={mrf} />
      </PDFViewer>
      <div className="flex justify-end">
        <PDFDownloadLink document={<MRFPdfDocument mrf={mrf} />} fileName={`${mrf.mrfNumber || mrf.referenceNumber}-Requisition-Form.pdf`}>
          {(state: { loading: boolean }) => (
            <Button disabled={state.loading}>
              {state.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download PDF
            </Button>
          )}
        </PDFDownloadLink>
      </div>
    </div>
  );
}
