import path from "path";

import { createWorker } from "tesseract.js";

/** Egyptian national IDs are 14 digits and start with 2 (1900s) or 3 (2000s). */
const EGYPTIAN_NATIONAL_ID_PATTERN = /[23]\d{13}/;

function getTesseractOptions() {
  const root = process.cwd();

  return {
    workerPath: path.join(
      root,
      "node_modules/tesseract.js/src/worker-script/node/index.js"
    ),
    corePath: path.join(
      root,
      "node_modules/tesseract.js-core/tesseract-core.wasm.js"
    ),
    workerBlobURL: false,
  };
}

function cleanOcrText(raw: string): string {
  const normalized = raw
    .replace(/\s/g, "")
    .replace(/[Oo]/g, "0")
    .replace(/[Il|]/g, "1")
    .replace(/[Bb]/g, "8")
    .replace(/[Ss]/g, "5")
    .replace(/[Zz]/g, "2");

  return normalized.replace(/\D/g, "");
}

export async function extractEgyptianNationalId(
  imageBuffer: Buffer
): Promise<string | null> {
  let worker;
  try {
    worker = await createWorker("eng", undefined, getTesseractOptions());
    const result = await worker.recognize(imageBuffer);
    const cleaned = cleanOcrText(result.data.text);
    const match = cleaned.match(EGYPTIAN_NATIONAL_ID_PATTERN);
    return match?.[0] ?? null;
  } catch (error) {
    console.error("[ocr] extractEgyptianNationalId failed:", error);
    return null;
  } finally {
    await worker?.terminate();
  }
}
