import fs from "fs";
import path from "path";
import { chromium } from "playwright";

const ROOT = process.cwd();
const MASTERS = path.join(ROOT, "docs/official-documents-samples/handover-masters");
const ARTIFACTS = "/opt/cursor/artifacts";
fs.mkdirSync(ARTIFACTS, { recursive: true });

const pairs = [
  ["green-avenue-dual-page1.png", "pdf-green-avenue-dual-vs-master.png"],
  ["jura-dual-page1.png", "pdf-jura-dual-vs-master.png"],
];

async function compositeSideBySide(left, right, out) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const leftB64 = fs.readFileSync(left).toString("base64");
  const rightB64 = fs.readFileSync(right).toString("base64");
  await page.setContent(`<!DOCTYPE html><html><body style="margin:0;background:#f1f5f9;font-family:sans-serif">
  <div style="padding:12px;font-weight:600">Rendered (fake data) · Master PDF</div>
  <div style="display:flex;gap:8px;padding:8px">
    <img src="data:image/png;base64,${leftB64}" style="width:49%;border:1px solid #cbd5e1"/>
    <img src="data:image/png;base64,${rightB64}" style="width:49%;border:1px solid #cbd5e1"/>
  </div>
</body></html>`);
  await page.screenshot({ path: out, fullPage: true });
  await browser.close();
}

async function renderDialogFixture(name, bodyHtml) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 820 } });
  await page.setContent(bodyHtml);
  await page.screenshot({ path: path.join(ARTIFACTS, name) });
  await browser.close();
  console.log("Wrote", name);
}

const dialogHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"/>
<style>
  body{margin:0;font-family:system-ui,sans-serif;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;min-height:100vh}
  .dlg{background:#fff;border-radius:12px;width:680px;max-width:95vw;padding:20px;box-shadow:0 20px 50px rgba(0,0,0,.2)}
  .warn{background:#fef3c7;border:1px solid #f59e0b;padding:12px;border-radius:8px;font-size:14px;margin:12px 0}
  .tag{font-size:12px;color:#64748b}
  h2{margin:0 0 8px;font-size:18px}
  ul{margin:8px 0;padding-right:20px;font-size:13px}
  .btn{display:inline-block;margin-top:8px;padding:6px 12px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px}
  select{margin:8px 0;padding:8px;width:100%}
  textarea{width:100%;height:120px;font-family:monospace;font-size:12px;margin-top:8px}
</style></head><body>
<div class="dlg">
  <div class="tag">Official document drafts · Handover record</div>
  <h2>تعديل نص المسودة</h2>
  <label>Handover template variant</label>
  <select><option selected>Green Avenue — two owners (no deposit)</option></select>
  <div class="warn">
    <strong>Some placeholders are still blank.</strong>
    <p style="font-size:12px;margin:8px 0">This unit lists two owners in one client name. Add co-owner contact details, or split the name into separate client records.</p>
    <ul>
      <li>الرقم القومي للمالك الثاني</li>
      <li>عنوان المالك الثاني</li>
    </ul>
    <span class="btn">Split merged name into co-owner record</span>
  </div>
  <textarea dir="rtl">… محضر تسليم … يوسف شنودة … مريم ماهر …</textarea>
  <p style="font-size:12px;color:#b45309">Cannot generate PDF — complete co-owner national ID and address.</p>
</div>
</body></html>`;

const confirmHtml = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/>
<style>
  body{margin:0;font-family:system-ui,sans-serif;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;min-height:100vh}
  .dlg{background:#fff;border-radius:12px;width:440px;padding:20px}
  h2{margin:0 0 12px;font-size:18px}
  .box{border:1px solid #e2e8f0;background:#f8fafc;padding:12px;border-radius:8px;font-size:13px}
  label{display:block;margin-top:10px;font-size:13px;font-weight:600}
  input{width:100%;padding:8px;margin-top:4px;box-sizing:border-box}
  .footer{display:flex;gap:8px;justify-content:flex-end;margin-top:16px}
  button{padding:8px 14px;border-radius:6px;border:1px solid #cbd5e1;background:#fff}
  .primary{background:#0f172a;color:#fff;border-color:#0f172a}
</style></head><body>
<div class="dlg">
  <h2>Split merged owners</h2>
  <p style="font-size:14px">The primary client keeps owner 1 data. A new co-owner record will be created for owner 2.</p>
  <div class="box">
    <div><strong>Primary:</strong> Youssef Shenouda (fake)</div>
    <div><strong>New co-owner:</strong> Mariam Maher (fake)</div>
  </div>
  <p style="font-size:12px;color:#64748b">Logged in audit trail.</p>
  <label>Co-owner national ID</label>
  <input value="29001019876543" />
  <label>Co-owner phone</label>
  <input value="01009876543" />
  <div class="footer">
    <button>Cancel</button>
    <button class="primary">Confirm split</button>
  </div>
</div>
</body></html>`;

for (const [file, out] of pairs) {
  const sample = path.join(MASTERS, file);
  const master = path.join(MASTERS, file);
  if (fs.existsSync(sample)) {
    await compositeSideBySide(sample, master, path.join(ARTIFACTS, out));
    console.log("Wrote", out);
  }
}

await renderDialogFixture("handover-merged-generate-dialog-en.png", dialogHtml);
await renderDialogFixture("handover-convert-coowner-confirm-en.png", confirmHtml);