import { readFile } from "fs/promises";

// Patterns for key document fields
const PATTERNS = {
  AADHAAR: {
    aadhaarNumber: /\b\d{4}\s\d{4}\s\d{4}\b/,
    name: /(?:Name|नाम)[:\s]+([A-Za-z\s]+)/i,
    dob: /(?:DOB|Date of Birth|जन्म तिथि)[:\s]+([\d/\-]+)/i,
  },
  PAN: {
    panNumber: /\b[A-Z]{5}\d{4}[A-Z]\b/,
    name: /(?:Name|नाम)[:\s]*\n?([A-Za-z\s]+)/i,
  },
  PASSPORT: {
    passportNumber: /\b[A-Z]\d{7}\b/,
    name: /(?:Surname|Given Name)[:\s]+([A-Za-z\s]+)/i,
    nationality: /(?:Nationality|नागरिकता)[:\s]+([A-Za-z\s]+)/i,
    dob: /(?:Date of Birth|D\.O\.B)[:\s]+([\d/\-A-Za-z\s]+)/i,
    expiry: /(?:Date of Expiry|Expiry)[:\s]+([\d/\-A-Za-z\s]+)/i,
  },
  BANK_DETAILS: {
    accountNumber: /(?:Account\s*(?:No|Number|#))[:\s]*(\d[\d\s]+\d)/i,
    ifsc: /\b[A-Z]{4}0[A-Z0-9]{6}\b/,
    bankName: /(?:Bank\s*Name|Bank)[:\s]+([A-Za-z\s]+)/i,
  },
};

function extractFields(text: string, docType: string): Record<string, string> {
  const patterns = PATTERNS[docType as keyof typeof PATTERNS];
  if (!patterns) return {};
  const result: Record<string, string> = {};
  for (const [field, pattern] of Object.entries(patterns)) {
    const match = text.match(pattern as RegExp);
    if (match) result[field] = (match[1] || match[0]).trim().slice(0, 200);
  }
  return result;
}

export async function extractDocumentData(
  filePath: string,
  mimeType: string,
  documentType: string
): Promise<Record<string, string> | null> {
  try {
    if (!mimeType.includes("pdf")) return null;
    const buffer = await readFile(filePath);
    // Dynamic import to avoid edge runtime issues
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfModule = await import("pdf-parse" as any);
    const pdfParse = pdfModule.default || pdfModule;
    const data = await pdfParse(buffer);
    const text = data.text || "";
    if (!text.trim()) return null;
    const fields = extractFields(text, documentType);
    return Object.keys(fields).length > 0 ? fields : { rawText: text.slice(0, 500) };
  } catch {
    return null;
  }
}
