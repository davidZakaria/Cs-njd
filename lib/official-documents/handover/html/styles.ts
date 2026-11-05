export const HANDOVER_PRINT_CSS = `
@page {
  size: A4;
  margin: 0;
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
  line-height: 1.5;
  direction: rtl;
  text-align: right;
  color: #000;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.page-border-outer {
  width: 210mm;
  min-height: 297mm;
  margin: 0 auto;
  border: 0.6pt solid #000;
  padding: 1.2pt;
  background: #fff;
}

.page-border-inner {
  border: 0.6pt solid #000;
  min-height: calc(297mm - 4pt);
}

.page-frame {
  width: 100%;
  min-height: 100%;
  margin: 0;
  padding: 10mm 12mm 12mm;
  border: none;
  box-shadow: none;
  position: relative;
  background: #fff;
  overflow: hidden;
}

.watermark {
  position: absolute;
  left: 50%;
  top: 46%;
  transform: translate(-50%, -50%) rotate(-35deg);
  font-size: 42pt;
  font-weight: bold;
  color: rgba(160, 160, 160, 0.38);
  white-space: nowrap;
  pointer-events: none;
  z-index: 2;
  user-select: none;
}

.page-content {
  position: relative;
  z-index: 3;
}

.doc-header {
  position: relative;
  min-height: 22mm;
  margin-bottom: 5mm;
}

.doc-logo {
  position: absolute;
  left: 0;
  top: 0;
  height: 14mm;
  width: auto;
  max-width: 72mm;
  object-fit: contain;
  object-position: left top;
}

.ltr-isolate {
  unicode-bidi: isolate;
  direction: ltr;
}

.title-block {
  text-align: center;
  padding-top: 1mm;
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
  margin: 4mm 0 2mm;
  font-size: 11pt;
}

.declaration-title {
  text-align: center;
  font-weight: 700;
  font-size: 16pt;
  text-decoration: underline;
  text-underline-offset: 3px;
  margin: 5mm 0 3mm;
}

.field-line {
  margin: 1.8mm 0;
  line-height: 1.55;
}

.field-label {
  font-weight: 600;
}

.field-value {
  font-weight: 500;
}

.field-row-spread {
  display: flex;
  flex-wrap: wrap;
  gap: 2mm 10mm;
  align-items: baseline;
  margin: 1.8mm 0;
}

p.justified,
.justified {
  text-align: justify;
  text-justify: inter-word;
  margin: 2mm 0;
  line-height: 1.55;
}

.declaration-intro {
  margin: 2mm 0;
  font-weight: 600;
}

.declaration-intro-center {
  text-align: center;
  font-weight: 700;
  margin: 2mm 0;
}

.closing-line {
  text-align: center;
  margin: 4mm 0 2mm;
  font-weight: 600;
}

.signature-block {
  margin: 5mm 0 6mm;
  break-inside: avoid;
}

.signature-heading {
  text-align: center;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 2px;
  margin-bottom: 6mm;
}

.signature-row {
  display: flex;
  justify-content: space-between;
  gap: 8mm;
  margin-top: 4mm;
}

.signature-cell {
  flex: 1;
  min-width: 0;
}

.signature-cell span.label {
  font-weight: 600;
  margin-left: 2mm;
}

.dotted-line {
  display: inline-block;
  min-width: 52mm;
  border-bottom: 1px dotted #000;
  vertical-align: baseline;
  height: 1em;
}

.missing-field {
  background: #fff0a3;
  color: #7a0000;
  padding: 0 2px;
  border-radius: 1px;
}

.owner-block {
  margin-bottom: 3mm;
}

.page-break {
  break-before: page;
}
`.trim();
