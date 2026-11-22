/**
 * Static walkthrough screenshots (fake data) when no DB is available.
 * Mirrors notification + log-call UI copy from messages/en.json & ar.json.
 */
import fs from "fs";
import path from "path";
import { chromium } from "playwright";

const ARTIFACT_ROOT = "/opt/cursor/artifacts";
const VIEWPORT = { width: 1280, height: 800 };

const COPY = {
  en: {
    dialogTitle: "📞 Log call",
    outcome: "Call outcome",
    placeholder: "Select outcome",
    answered: "Answered",
    notes: "Case notes",
    noteValue: "📞 Walkthrough — client will visit next week",
    cancel: "Cancel",
    submit: "📞 Log call",
    inboxTitle: "Activity inbox",
    tabCallLogs: "Call logs",
    tabRequests: "Requests & files",
    tabOverdue: "Overdue tasks",
    empty: "No call log activity yet.",
    notificationTitle: "Call answered",
    notificationBody:
      "Demo Community · answered · Unit CALLLOG-DEMO · Walkthrough Client · 📞 Walkthrough — client will visit next week",
  },
  ar: {
    dialogTitle: "📞 تسجيل مكالمة",
    outcome: "نتيجة المكالمة",
    placeholder: "اختر النتيجة",
    answered: "تم الرد",
    notes: "ملاحظات البلاغ",
    noteValue: "📞 تجربة — موعد زيارة الأسبوع القادم",
    cancel: "إلغاء",
    submit: "📞 تسجيل مكالمة",
    inboxTitle: "صندوق النشاط",
    tabCallLogs: "سجل المكالمات",
    tabRequests: "الطلبات والملفات",
    tabOverdue: "المهام المتأخرة",
    empty: "لا يوجد نشاط مكالمات بعد.",
    notificationTitle: "مكالمة تم الرد عليها",
    notificationBody:
      "Demo Community · تم الرد · وحدة CALLLOG-DEMO · عميل تجربة · 📞 تجربة — موعد زيارة الأسبوع القادم",
  },
} as const;

function shell(locale: "en" | "ar", body: string) {
  const dir = locale === "ar" ? "rtl" : "ltr";
  return `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
<meta charset="utf-8"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Inter, system-ui, sans-serif; background: #f4f4f5; color: #18181b; }
  .wrap { padding: 48px; display: flex; justify-content: center; }
  .card { background: #fff; border: 1px solid #e4e4e7; border-radius: 12px; box-shadow: 0 1px 2px rgba(0,0,0,.06); width: 100%; max-width: 896px; }
  .card-h { padding: 20px 24px; border-bottom: 1px solid #e4e4e7; font-size: 18px; font-weight: 600; }
  .card-b { padding: 24px; }
  .dialog { max-width: 448px; margin: 0 auto; border: 1px solid #e4e4e7; border-radius: 12px; padding: 24px; background: #fff; box-shadow: 0 10px 40px rgba(0,0,0,.12); }
  .label { font-size: 12px; font-weight: 500; color: #71717a; margin-bottom: 6px; display: block; }
  .field { margin-bottom: 16px; }
  .select, textarea { width: 100%; border: 1px solid #e4e4e7; border-radius: 8px; padding: 10px 12px; font-size: 14px; background: #fff; }
  textarea { min-height: 96px; resize: vertical; font-family: inherit; }
  .footer { display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; }
  .btn { border-radius: 8px; padding: 8px 14px; font-size: 14px; font-weight: 500; border: 1px solid #e4e4e7; background: #fff; }
  .btn-primary { background: #18181b; color: #fff; border-color: #18181b; }
  .tabs { display: flex; gap: 8px; margin-bottom: 20px; }
  .tab { padding: 8px 14px; border-radius: 8px; font-size: 13px; border: 1px solid #e4e4e7; background: #fafafa; color: #52525b; }
  .tab.active { background: #18181b; color: #fff; border-color: #18181b; }
  .empty { text-align: center; color: #71717a; font-size: 14px; padding: 48px 16px; }
  .row { border: 1px solid #e4e4e7; border-radius: 10px; padding: 16px; margin-bottom: 10px; }
  .row h3 { margin: 0 0 8px; font-size: 15px; }
  .row p { margin: 0; font-size: 13px; color: #52525b; line-height: 1.5; }
  .meta { font-size: 11px; color: #a1a1aa; margin-top: 8px; }
</style>
</head>
<body>${body}</body>
</html>`;
}

function dialogHtml(locale: "en" | "ar") {
  const c = COPY[locale];
  return shell(
    locale,
    `<div class="wrap"><div class="dialog">
      <h2 style="margin:0 0 20px;font-size:18px;">${c.dialogTitle}</h2>
      <div class="field"><span class="label">${c.outcome}</span>
        <div class="select">${c.answered}</div>
      </div>
      <div class="field"><span class="label">${c.notes}</span>
        <textarea readonly>${c.noteValue}</textarea>
      </div>
      <div class="footer">
        <button class="btn">${c.cancel}</button>
        <button class="btn btn-primary">${c.submit}</button>
      </div>
    </div></div>`
  );
}

function inboxHtml(locale: "en" | "ar", phase: "empty" | "filled") {
  const c = COPY[locale];
  const items =
    phase === "empty"
      ? `<p class="empty">${c.empty}</p>`
      : `<div class="row">
          <h3>${c.notificationTitle}</h3>
          <p>${c.notificationBody}</p>
          <p class="meta">Today · /units/demo?tab=timeline</p>
        </div>`;
  return shell(
    locale,
    `<div class="wrap"><div class="card">
      <div class="card-h">${c.inboxTitle}</div>
      <div class="card-b">
        <div class="tabs">
          <span class="tab active">${c.tabCallLogs}</span>
          <span class="tab">${c.tabRequests}</span>
          <span class="tab">${c.tabOverdue}</span>
        </div>
        ${items}
      </div>
    </div></div>`
  );
}

async function main() {
  fs.mkdirSync(ARTIFACT_ROOT, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  const shots: Array<{ html: string; name: string; locale: "en" | "ar" }> = [
    { html: dialogHtml("en"), name: "call_logs_log_call_dialog_en.png", locale: "en" },
    { html: dialogHtml("ar"), name: "call_logs_log_call_dialog_ar.png", locale: "ar" },
    { html: inboxHtml("en", "empty"), name: "call_logs_inbox_manager_before_en.png", locale: "en" },
    { html: inboxHtml("en", "filled"), name: "call_logs_inbox_manager_after_en.png", locale: "en" },
    { html: inboxHtml("en", "filled"), name: "call_logs_inbox_cs_agent_en.png", locale: "en" },
    { html: inboxHtml("ar", "filled"), name: "call_logs_inbox_cs_agent_ar.png", locale: "ar" },
  ];

  for (const shot of shots) {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      locale: shot.locale === "ar" ? "ar-EG" : "en-US",
    });
    const page = await context.newPage();
    await page.setContent(shot.html, { waitUntil: "load" });
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, shot.name),
      fullPage: false,
    });
    await context.close();
  }

  await browser.close();
  console.log(`Rendered walkthrough screenshots → ${ARTIFACT_ROOT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});