export const HANDOVER_PRINT_CSS = `
@page {
  size: A4;
  margin: 10mm 18mm 11mm 11mm;
}

* {
  box-sizing: border-box;
}

html, body {
  margin: 0;
  padding: 0;
  width: auto;
  max-width: none;
}

body {
  font-family: "HandoverArabic", "Traditional Arabic", "Simplified Arabic", serif;
  font-size: 11pt;
  line-height: 1.48;
  direction: rtl;
  text-align: right;
  color: #000;
  overflow-x: hidden;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.doc-body {
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  margin: 0;
  padding: 0;
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
}

.print-frame-outer {
  top: 5mm;
  left: 5mm;
  right: 5mm;
  bottom: 5mm;
  border: 0.55pt solid #000;
}

.print-frame-inner {
  top: 6.5mm;
  left: 6.5mm;
  right: 6.5mm;
  bottom: 6.5mm;
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

.doc-header {
  margin-bottom: 4mm;
  max-width: 100%;
}

.doc-logo {
  display: block;
  height: 12mm;
  width: auto;
  max-width: 58mm;
  object-fit: contain;
  object-position: right top;
  margin-bottom: 3mm;
  margin-inline-start: auto;
  margin-inline-end: 0;
}

.title-block {
  text-align: center;
  width: 100%;
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
}

.field-row-spread {
  display: flex;
  flex-wrap: wrap;
  gap: 2mm 8mm;
  align-items: baseline;
  margin: 1.5mm 0;
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
  margin: 4mm 0 5mm;
  break-inside: avoid;
}

.signature-page-break {
  break-after: auto;
  page-break-after: auto;
}

.signature-block-closing {
  margin-top: 6mm;
  break-inside: avoid;
  page-break-inside: avoid;
}

.jura-finale {
  break-inside: avoid-page;
  page-break-inside: avoid;
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
  gap: 8mm;
  margin-top: 3mm;
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

.violations-block {
  break-inside: auto;
}

.violations-block p {
  margin: 1.2mm 0;
}

.insurance-block {
  margin-top: 2mm;
}
`.trim();
