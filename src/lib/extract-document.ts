// Patterns for key document fields
const PATTERNS = {
  AADHAAR: {
    aadhaarNumber: /\b\d{4}\s\d{4}\s\d{4}\b/,
    name: /(?:Name|नाम)[:\s]+([A-Za-z\s]+)/i,
    dob: /(?:DOB|Date of Birth|जन्म तिथि)[:\s]+([\d/\-]+)/i,
    // Aadhaar prints the address as a multi-line block ending in a 6-digit
    // PIN code — best-effort only, real-world layouts/OCR noise vary a lot.
    address: /(?:Address|पता)[:\s]+([\s\S]{10,300}?\d{6})/i,
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
    // Older Indian passports print a full address on the back page; newer
    // ones may omit it entirely — best-effort only.
    address: /(?:Address)[:\s]+([\s\S]{10,300}?\d{6})/i,
  },
  BANK_DETAILS: {
    accountNumber: /(?:Account\s*(?:No|Number|#))[:\s]*(\d[\d\s]+\d)/i,
    ifsc: /\b[A-Z]{4}0[A-Z0-9]{6}\b/,
    bankName: /(?:Bank\s*Name|Bank)[:\s]+([A-Za-z\s]+)/i,
  },
};

// Shells out to scripts/ocr_extract.py (EasyOCR) per call — this reloads the
// OCR model from disk every invocation (several seconds), which is fine for
// the manual "Fetch Address" button this backs but would not scale to a
// high-volume/automatic extraction path (that would need a standalone,
// always-on OCR service instead of a spawned-per-request script).
async function runEasyOcr(buffer: Buffer, mimeType: string): Promise<string> {
  const { spawn } = await import("child_process");
  const { writeFile, unlink } = await import("fs/promises");
  const { tmpdir } = await import("os");
  const { join } = await import("path");

  const ext = mimeType.includes("png") ? ".png" : mimeType.includes("webp") ? ".webp" : ".jpg";
  const tmpPath = join(tmpdir(), `ocr-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  await writeFile(tmpPath, buffer);

  try {
    const stdout = await new Promise<string>((resolve, reject) => {
      const proc = spawn(process.env.PYTHON_BIN || "python", [join(process.cwd(), "scripts", "ocr_extract.py"), tmpPath]);
      let out = "";
      let err = "";
      proc.stdout.on("data", (d) => { out += d; });
      proc.stderr.on("data", (d) => { err += d; });
      proc.on("error", reject);
      proc.on("close", (code) => {
        if (code !== 0) reject(new Error(err.trim().split("\n").pop() || `OCR process exited with code ${code}`));
        else resolve(out);
      });
    });
    const parsed = JSON.parse(stdout.trim());
    if (parsed.error) throw new Error(parsed.error);
    return parsed.text || "";
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}

function extractFields(text: string, docType: string): Record<string, string> {
  const patterns = PATTERNS[docType as keyof typeof PATTERNS];
  if (!patterns) return {};
  const result: Record<string, string> = {};
  for (const [field, pattern] of Object.entries(patterns)) {
    const match = text.match(pattern as RegExp);
    if (!match) continue;
    let value = (match[1] || match[0]).trim();
    // Address spans multiple printed lines — collapse to a single readable
    // line rather than pasting raw newlines into a form field.
    if (field === "address") value = value.replace(/\s*\n\s*/g, ", ").replace(/\s{2,}/g, " ");
    result[field] = value.slice(0, 300);
  }
  return result;
}

export async function extractDocumentData(
  buffer: Buffer,
  mimeType: string,
  documentType: string
): Promise<Record<string, string> | null> {
  try {
    let text = "";
    if (mimeType.includes("pdf")) {
      // Dynamic import to avoid edge runtime issues
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfModule = await import("pdf-parse" as any);
      const pdfParse = pdfModule.default || pdfModule;
      const data = await pdfParse(buffer);
      text = data.text || "";
    } else if (mimeType.startsWith("image/")) {
      // OCR via EasyOCR (Python, spawned per call — see runEasyOcr). Needs
      // Python 3 + `pip install easyocr` on whatever machine runs this.
      text = await runEasyOcr(buffer, mimeType);
    } else {
      return null;
    }
    if (!text.trim()) return null;
    const fields = extractFields(text, documentType);
    return Object.keys(fields).length > 0 ? fields : { rawText: text.slice(0, 500) };
  } catch {
    return null;
  }
}
