import type { HandoverFieldValues } from "@/lib/print/handover-templates/types";
import type { HandoverTemplateKey } from "@/lib/print/handover-templates/types";

import { buildOfficialHandoverHtml } from "@/lib/official-documents/handover/html/build-handover-html";
import { renderHandoverHtmlToPdf } from "@/lib/official-documents/handover/html/chromium-pdf";

export async function renderOfficialHandoverRecordPdf(input: {
  templateKey: HandoverTemplateKey;
  fields: HandoverFieldValues;
  watermarkDraft: boolean;
  companyAddress?: string;
  draftBody?: string;
}): Promise<Uint8Array> {
  void input.companyAddress;
  const html = buildOfficialHandoverHtml({
    templateKey: input.templateKey,
    fields: input.fields,
    watermarkDraft: input.watermarkDraft,
    draftBody: input.draftBody,
  });
  return renderHandoverHtmlToPdf(html);
}

export { buildOfficialHandoverHtml } from "@/lib/official-documents/handover/html/build-handover-html";
export {
  closeHandoverPdfBrowser,
  renderHandoverHtmlPageOnePng,
  renderHandoverHtmlToPdf,
  renderPdfBufferToPngPages,
} from "@/lib/official-documents/handover/html/chromium-pdf";
