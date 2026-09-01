import fs from "node:fs";
import path from "node:path";

const sourceDir = path.join(process.cwd(), "lib/print/handover-templates/source");
const outDir = path.join(process.cwd(), "lib/print/handover-templates/generated");

fs.mkdirSync(outDir, { recursive: true });

function splitGreenAvenue(text) {
  const insuranceMarker =
    "و في حالة رغبة الطرف الثاني المشتري في إجراء تعديلات داخلية للوحدة المبيعة بموافقة الشركة";
  const violationsMarker = "المخالفات المتسببة فى فسخ العقد";
  const declarationMarker = "إقرار";
  const section2Marker = "ثانيا : بيانات الوحدة";
  const section1Marker = "اولا : - بيانات المستلم";

  const section1Start = text.indexOf(section1Marker);
  const section2Start = text.indexOf(section2Marker);
  const declarationStart = text.indexOf(declarationMarker, section2Start);
  const violationsStart = text.indexOf(violationsMarker);
  const insuranceStart = text.indexOf(insuranceMarker);

  const header = text.slice(0, section1Start).trim();
  const section1 = text.slice(section1Start, section2Start).trim();
  const section2 = text.slice(section2Start, declarationStart).trim();
  const declaration = text.slice(declarationStart + declarationMarker.length, violationsStart).trim();
  const violationsIntro = violationsMarker;
  let violationsBody = text.slice(violationsStart + violationsMarker.length).trim();

  let insurance = null;
  if (insuranceStart !== -1) {
    const beforeInsurance = text.slice(violationsStart, insuranceStart);
    violationsBody = beforeInsurance.slice(violationsMarker.length).trim();
    const afterInsurance = text.slice(insuranceStart);
    const closingMarker = "كل ما ورد من انواع المخالفات";
    const closingStart = afterInsurance.indexOf(closingMarker);
    insurance = afterInsurance.slice(0, closingStart).trim();
    violationsBody = `${violationsBody}\n${afterInsurance.slice(closingStart).trim()}`;
  }

  const dual = section1.includes("1-الاسم");

  return {
    header,
    section1,
    section2,
    declaration,
    violationsIntro,
    violationsBody,
    insurance,
    dual,
    withInsurance: insurance != null,
  };
}

function splitJura(text) {
  const sections = [];
  const markers = [
    "ثانيا :",
    "ثالثا :",
    "رابعا :",
    "خامسا :",
    "سادسا:",
    "سابعا:",
    "عاشراً:",
  ];
  const introEnd = text.indexOf("1-أقـر انا");
  const header = text.slice(0, introEnd).trim();
  const body = text.slice(introEnd);

  let cursor = 0;
  const parts = [{ key: "intro", text: body }];
  for (const marker of markers) {
    const idx = body.indexOf(marker, cursor);
    if (idx === -1) continue;
    parts[parts.length - 1].text = body.slice(cursor, idx).trim();
    parts.push({ key: marker.replace(/\s+/g, " ").replace(":", ""), text: "" });
    cursor = idx;
  }
  if (parts.length) {
    parts[parts.length - 1].text = body.slice(cursor).trim();
  }

  const dual = text.includes("2-أقـر") || text.includes("2-الاسم");

  return { header, parts, dual };
}

const mapping = {
  "محضر-استلام-GRENN-AVENUE.txt": "green-avenue",
  "محضر-استلام-GRENN-AVENUE-(بدون-تأمين).txt": "green-avenue-no-insurance",
  "محضر-استلام-GRENN-AVENUE-توقيع-فردين.txt": "green-avenue-dual",
  "محضر-استلام-GRENN-AVENUE-توقيع-فردين-(بدون-تأمين).txt":
    "green-avenue-dual-no-insurance",
  "محضر-استلام-JURA.txt": "jura",
  "محضر-استلام-JURA-(لفردين).txt": "jura-dual",
};

const manifest = {};

for (const [file, key] of Object.entries(mapping)) {
  const raw = fs.readFileSync(path.join(sourceDir, file), "utf8");
  const parsed = key.startsWith("green") ? splitGreenAvenue(raw) : splitJura(raw);
  manifest[key] = parsed;
  fs.writeFileSync(
    path.join(outDir, `${key}.json`),
    JSON.stringify(parsed, null, 2),
    "utf8"
  );
  console.log(`Generated ${key}.json`);
}

fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
