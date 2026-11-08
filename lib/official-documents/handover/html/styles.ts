/**
 * Handover print layout (Chromium paged media):
 * - @page margin = outer border inset from the physical sheet (8mm).
 * - position:fixed .print-frame at 0/1.5mm draws the double frame on the page box edge.
 * - .doc-body padding = remaining inset so text sits at 16mm (~6.5mm inside inner border).
 */
export const HANDOVER_BORDER_OUTER_INSET_MM = 8;
export const HANDOVER_BORDER_INNER_INSET_MM = 9.5;
/** Total content inset from physical page edge (equivalent to @page margin 16mm). */
export const HANDOVER_PAGE_MARGIN_MM = 16;
export const HANDOVER_CONTENT_PADDING_MM =
  HANDOVER_PAGE_MARGIN_MM - HANDOVER_BORDER_OUTER_INSET_MM;
export const HANDOVER_BORDER_INNER_OFFSET_MM =
  HANDOVER_BORDER_INNER_INSET_MM - HANDOVER_BORDER_OUTER_INSET_MM;
/** Space reserved at page bottom so body text does not run under the repeated declarant footer. */
export const HANDOVER_DECLARANT_FOOTER_RESERVE_MM = 26;
export const HANDOVER_DECLARANT_FOOTER_BOTTOM_MM =
  HANDOVER_BORDER_INNER_OFFSET_MM + 3;

export const HANDOVER_PRINT_CSS = `
@page {
  size: A4;
  margin: ${HANDOVER_BORDER_OUTER_INSET_MM}mm;
}

* {
  box-sizing: border-box;
}

html, body {
  margin: 0;
  padding: 0;
}

body {
  font-family: "HandoverArabic", "Traditional Arabic", "Simplified Arabic", serif;
  font-size: 11pt;
  line-height: 1.48;
  direction: rtl;
  text-align: right;
  color: #000;
  overflow: visible;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.doc-body {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 100%;
  margin: 0;
  padding: ${HANDOVER_CONTENT_PADDING_MM}mm;
  padding-bottom: ${HANDOVER_CONTENT_PADDING_MM + HANDOVER_DECLARANT_FOOTER_RESERVE_MM}mm;
  box-sizing: border-box;
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
  overflow-wrap: break-word;
  word-wrap: break-word;
}

.handover-jura .doc-body {
  font-size: 11.5pt;
  line-height: 1.62;
}

.handover-green .print-frame {
  border-style: solid;
}

.handover-jura .print-frame {
  border-style: dashed;
}

.print-frame {
  position: fixed;
  pointer-events: none;
  z-index: 1000;
  box-sizing: border-box;
}

.print-frame-outer {
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border: 0.55pt solid #000;
}

.print-frame-inner {
  top: ${HANDOVER_BORDER_INNER_OFFSET_MM}mm;
  left: ${HANDOVER_BORDER_INNER_OFFSET_MM}mm;
  right: ${HANDOVER_BORDER_INNER_OFFSET_MM}mm;
  bottom: ${HANDOVER_BORDER_INNER_OFFSET_MM}mm;
  border: 0.55pt solid #000;
}

.watermark {
  position: fixed;
  left: 50%;
  top: 46%;
  transform: translate(-50%, -50%) rotate(-35deg);
  font-size: 42pt;
  font-weight: bold;
  color: rgba(160, 160, 160, 0.38);
  white-space: nowrap;
  pointer-events: none;
  z-index: 999;
  user-select: none;
}

.handover-declarant-footer {
  position: fixed;
  left: ${HANDOVER_PAGE_MARGIN_MM}mm;
  right: ${HANDOVER_PAGE_MARGIN_MM}mm;
  bottom: ${HANDOVER_DECLARANT_FOOTER_BOTTOM_MM}mm;
  z-index: 900;
  pointer-events: none;
  box-sizing: border-box;
  padding: 0 1mm;
  background: #fff;
}

.handover-declarant-footer .signature-block {
  margin: 0;
  padding: 0;
  max-width: 100%;
}

.doc-header {
  margin-bottom: 4mm;
  max-width: 100%;
}

.doc-logo {
  display: block;
  height: 11mm;
  width: auto;
  max-width: 52mm;
  object-fit: contain;
  object-position: left center;
  margin-block: 0 3mm;
  margin-inline-start: 0;
  margin-inline-end: auto;
}

.title-block {
  text-align: center;
  width: 100%;
  max-width: 100%;
}

.title-line {
  font-weight: 700;
  font-size: 13pt;
  text-decoration: underline;
  text-underline-offset: 2px;
  margin: 0.8mm 0;
}

.title-line-sm {
  font-weight: 700;
  font-size: 11.5pt;
  text-decoration: underline;
  text-underline-offset: 2px;
  margin: 0.6mm 0;
}

.date-line {
  text-align: center;
  font-size: 10.5pt;
  margin-top: 2mm;
}

.section-heading {
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 2px;
  margin: 3.5mm 0 2mm;
  font-size: 11pt;
  break-after: avoid;
  max-width: 100%;
}

.section-body {
  font-weight: 400;
  text-decoration: none;
  text-align: justify;
  text-justify: inter-word;
  margin: 1.8mm 0;
  line-height: 1.52;
  orphans: 2;
  widows: 2;
}

p.justified,
.justified {
  text-align: justify;
  text-justify: inter-word;
  margin: 1.8mm 0;
  line-height: 1.52;
  orphans: 2;
  widows: 2;
  font-weight: 400;
  text-decoration: none;
}

.jura-thalitha-wrap {
  break-inside: avoid;
  page-break-inside: avoid;
  margin-top: 2mm;
  margin-bottom: 10mm;
  padding-bottom: 4mm;
}

.jura-thalitha-wrap .signature-block {
  padding-inline: 3mm;
  max-width: 100%;
  box-sizing: border-box;
}

.jura-thalitha-wrap .dotted-line {
  max-width: min(32mm, 42%);
}

.section-page-break {
  break-before: page;
  page-break-before: always;
}

.declaration-title {
  text-align: center;
  font-weight: 700;
  font-size: 16pt;
  text-decoration: underline;
  text-underline-offset: 3px;
  margin: 4mm 0 2.5mm;
  break-after: avoid;
}

.field-line {
  margin: 1.5mm 0;
  line-height: 1.55;
  max-width: 100%;
}

.field-label {
  font-weight: 600;
}

.field-value,
.ltr-field {
  font-weight: 500;
}

.ltr-field {
  direction: ltr;
  unicode-bidi: isolate;
  display: inline-block;
  text-align: left;
  max-width: 100%;
}

.field-row-spread {
  display: flex;
  flex-wrap: wrap;
  gap: 2mm 8mm;
  align-items: baseline;
  margin: 1.5mm 0;
  max-width: 100%;
}

.declaration-intro {
  margin: 1.5mm 0;
  font-weight: 600;
}

.declaration-intro-center {
  text-align: center;
  font-weight: 700;
  margin: 1.5mm 0;
}

.closing-line {
  text-align: center;
  margin: 3mm 0 2mm;
  font-weight: 600;
}

.signature-block {
  margin: 4mm 0 6mm;
  break-inside: avoid;
  max-width: 100%;
  padding-bottom: 2mm;
}

.signature-page-break {
  break-after: auto;
  page-break-after: auto;
}

.signature-block-closing {
  margin-top: 6mm;
  margin-bottom: 4mm;
  break-inside: avoid;
  page-break-inside: avoid;
  max-width: 100%;
  padding-top: 2mm;
}

.jura-finale {
  break-inside: avoid-page;
  page-break-inside: avoid;
  padding-bottom: 4mm;
}

.signature-heading {
  text-align: center;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 2px;
  margin-bottom: 5mm;
}

.signature-row {
  display: flex;
  justify-content: space-between;
  gap: 4mm;
  margin-top: 3mm;
  max-width: 100%;
  width: 100%;
  flex-wrap: wrap;
  box-sizing: border-box;
  padding-inline: 0;
}

.signature-cell {
  flex: 1 1 40%;
  min-width: 0;
  max-width: 100%;
}

.signature-cell span.label {
  font-weight: 600;
  margin-inline-start: 2mm;
}

.dotted-line {
  display: inline-block;
  min-width: 22mm;
  max-width: min(38mm, calc(100% - 2mm));
  border-bottom: 1px dotted #000;
  vertical-align: baseline;
  height: 1em;
}

.signature-block-closing .signature-row {
  flex-direction: column;
  align-items: stretch;
  gap: 3mm;
}

.signature-block-closing .signature-cell {
  flex: 0 0 auto;
  max-width: 100%;
  width: 100%;
}

.missing-field {
  background: #fff0a3;
  color: #7a0000;
  padding: 0 2px;
  border-radius: 1px;
}

.owner-block {
  margin-bottom: 3mm;
  max-width: 100%;
}

.violations-block {
  break-inside: auto;
  max-width: 100%;
}

.violations-block p {
  margin: 1.2mm 0;
}

.violation-item {
  orphans: 3;
  widows: 3;
}

.violation-page-break {
  break-before: page;
  page-break-before: always;
}

.handover-green .violations-block p {
  margin: 0.85mm 0;
  line-height: 1.46;
}

.handover-green .insurance-block {
  margin-top: 0.5mm;
  line-height: 1.46;
  break-inside: auto;
  page-break-inside: auto;
  orphans: 2;
  widows: 2;
}

.draft-legal-appendix {
  margin-top: 0.5mm;
  font-size: 10pt;
  line-height: 1.25;
  break-before: avoid-page;
  page-break-before: avoid;
}
`.trim();
