import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const docsDir = path.join(process.cwd(), "docs");
const outDir = path.join(process.cwd(), "lib/print/handover-templates/source");

fs.mkdirSync(outDir, { recursive: true });

const files = fs.readdirSync(docsDir).filter((f) => f.endsWith(".docx"));

for (const file of files) {
  const slug = file
    .replace(/\.docx$/i, "")
    .replace(/\s+/g, "-")
    .replace(/[^\w\u0600-\u06FF()-]+/g, "")
    .slice(0, 80);
  const tmp = path.join(docsDir, `_tmp_${slug}`);
  fs.mkdirSync(tmp, { recursive: true });
  fs.copyFileSync(path.join(docsDir, file), path.join(tmp, "z.zip"));
  execSync(
    `powershell -NoProfile -Command "Expand-Archive -Path '${path.join(tmp, "z.zip")}' -DestinationPath '${tmp}' -Force"`,
    { stdio: "inherit" }
  );
  const xml = fs.readFileSync(path.join(tmp, "word/document.xml"), "utf8");
  const text = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
    .map((m) => m[1])
    .join("");
  fs.writeFileSync(path.join(outDir, `${slug}.txt`), text, "utf8");
  console.log(`${file} -> ${text.length} chars -> ${slug}.txt`);
}
