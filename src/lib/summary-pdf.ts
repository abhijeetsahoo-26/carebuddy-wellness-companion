// Browser-only PDF writer for the doctor summary. Import dynamically (jsPDF needs window).
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { SUMMARY_FOOTER, SRC_CALC, SRC_YOU, type SummaryDoc } from "./summary";

// Built-in PDF fonts only cover Latin-1; replace anything else so nothing renders as boxes.
const safe = (s: string) => s.replace(/[\u2010-\u2015]/g, "-").replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
  .replace(/\u2026/g, "...").replace(/\u202F|\u00A0/g, " ").replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "?");

export function summaryPdf(doc: SummaryDoc): Blob {
  return new Blob([summaryPdfBytes(doc)], { type: "application/pdf" });
}

export function summaryPdfBytes(doc: SummaryDoc): ArrayBuffer {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const W = pdf.internal.pageSize.getWidth();
  const M = 14;
  let y = M;
  const g = doc.glance;

  const h1 = (t: string) => { pdf.setFont("helvetica", "bold"); pdf.setFontSize(18); pdf.text(safe(t), M, y); y += 8; };
  const h2 = (t: string, src: string) => {
    if (y > 260) { pdf.addPage(); y = M; }
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(14); pdf.text(safe(t), M, y); y += 5;
    pdf.setFont("helvetica", "italic"); pdf.setFontSize(9); pdf.text(pdf.splitTextToSize(safe(`Source: ${src}`), W - 2 * M), M, y); y += 5;
  };
  const para = (t: string) => {
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(11);
    const lines = pdf.splitTextToSize(safe(t), W - 2 * M); pdf.text(lines, M, y); y += lines.length * 5 + 1;
  };
  const table = (head: string[], body: string[][], empty = "Nothing in this range.", small?: number) => {
    if (!body.length) { para(empty); y += 2; return; }
    autoTable(pdf, {
      startY: y, head: [head.map(safe)], body: body.map((r) => r.map(safe)), margin: { left: M, right: M, bottom: 20 },
      styles: { fontSize: 9, cellPadding: 1.5 }, headStyles: { fillColor: [46, 125, 90] },
      columnStyles: small == null ? {} : { [small]: { fontSize: 7, textColor: [100, 100, 100] } },
    });
    y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  };

  // Page 1: At a glance
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(10); pdf.setTextColor(46, 125, 90); pdf.text("PATIENT SUMMARY - AT A GLANCE", M, y); y += 7;
  pdf.setTextColor(0, 0, 0);
  h1(g.name ?? "Name not given");
  table(["Item", "Value", "Source"], [
    ["Age group", g.ageGroup ?? "Not given", SRC_YOU],
    ["Date range", `${doc.range.from} to ${doc.range.to}`, SRC_YOU],
    ["Doctor's Plan used", g.plan ? `Version ${g.plan.version} (${g.plan.date})` : "None saved", SRC_YOU],
    ["Allergies", g.allergies ?? "None entered", SRC_YOU],
    ["Doses not marked", String(g.counts.notMarked), SRC_CALC],
    ["Doses skipped", String(g.counts.skipped), SRC_CALC],
    ["Doses taken late", String(g.counts.late), SRC_CALC],
    ["Most-logged symptoms", g.topSymptoms.length ? g.topSymptoms.map((s) => `${s.name} (${s.count})`).join(", ") : "None logged", SRC_CALC],
  ]);
  h2("Current medicines", `name and dose: ${SRC_YOU}; counts and adherence: ${SRC_CALC}`);
  table(["Medicine", "Dose", "Taken (incl. late) / due", "Adherence"],
    g.medicines.map((m) => [m.name, m.detail || "-", `${m.taken + m.late} / ${m.due}`, m.adherencePct == null ? "-" : `${m.adherencePct}%`]), "No current medicines.");

  const sections = doc.doses || doc.timeline || doc.meals || doc.numbers || doc.waterSleep || doc.appointments || doc.questions;
  if (sections) { pdf.addPage(); y = M; }

  if (doc.doses) { h2("Dose log", `status: ${SRC_YOU}`); table(["Date", "Time", "Medicine", "Status"], doc.doses.map((d) => [d.date, d.time, d.medicine, d.status])); }
  if (doc.timeline) {
    h2("Unwell checks and diary", `entries: ${SRC_YOU}; check result: ${SRC_CALC} by CareBuddy's fixed checklist`);
    table(["Date", "Time", "Type", "Details", "Severity (0-10)", "Result"], doc.timeline.map((t) => [t.date, t.time, t.kind, t.text, t.severity == null ? "-" : String(t.severity), t.result]));
  }
  if (doc.meals) {
    h2("Meals", `meals: ${SRC_YOU}; counts: ${SRC_CALC}`);
    para(`Total meals logged: ${doc.meals.total}${doc.meals.byType.length ? ` (${doc.meals.byType.map((b) => `${b.type}: ${b.count}`).join(", ")})` : ""}`);
    table(["Date", "Time", "Meal", "What was eaten"], doc.meals.rows.map((m) => [m.date, m.time, m.type, m.description]));
  }
  if (doc.numbers) {
    h2("My numbers", `readings: ${SRC_YOU}`);
    if (!doc.numbers.length) para("No readings in this range.");
    for (const n of doc.numbers) {
      if (y > 220) { pdf.addPage(); y = M; }
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(12); pdf.text(safe(`${n.label} (${n.unit})`), M, y); y += 3;
      if (n.rows.length > 1) { chart(pdf, M, y, W - 2 * M, 34, n.rows.map((r) => r.value), n.rows.map((r) => r.value2)); y += 40; }
      if (n.kind === "temperature") table(["Date", "Time", "Value (as entered)", "", "Source"], n.rows.map((r) => [r.date, r.time, r.display, r.converted ?? "", r.source]), undefined, 3);
      else table(["Date", "Time", `Value (${n.unit})`, "Source"], n.rows.map((r) => [r.date, r.time, r.display, r.source]));
    }
  }
  if (doc.waterSleep) {
    h2("Water and sleep", `glasses and hours: ${SRC_YOU}; averages: ${SRC_CALC}`);
    para(`Average water on days logged: ${doc.waterSleep.avgWater ?? "-"} glasses. Average sleep: ${doc.waterSleep.avgSleep ?? "-"} hours.`);
    table(["Date", "Water (glasses)", "Goal (glasses)", "Sleep (hours)"], doc.waterSleep.days.map((d) => [d.date, String(d.glasses), d.goal == null ? "-" : String(d.goal), d.sleep == null ? "-" : String(d.sleep)]));
  }
  if (doc.appointments) { h2("Appointments", SRC_YOU); table(["Date", "Time", "Doctor", "Purpose", "Place"], doc.appointments.map((a) => [a.date, a.time, a.doctor, a.purpose, a.location])); }
  if (doc.questions) {
    h2("Questions for my doctor", SRC_YOU);
    if (!doc.questions.length) para("No questions added.");
    doc.questions.forEach((q, i) => para(`${i + 1}. ${q}`));
  }

  // Footer on every page
  const pages = pdf.getNumberOfPages();
  const H = pdf.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setDrawColor(200); pdf.line(M, H - 15, W - M, H - 15);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.setTextColor(0, 0, 0);
    pdf.text(SUMMARY_FOOTER, M, H - 10.5);
    pdf.setFont("helvetica", "normal");
    pdf.text(safe(`Generated ${doc.generatedAtLabel}. Dates YYYY-MM-DD, India time.   Page ${i} of ${pages}`), M, H - 6.5);
  }
  return pdf.output("arraybuffer");
}

function chart(pdf: jsPDF, x: number, y: number, w: number, h: number, a: number[], b: (number | null)[]) {
  const all = [...a, ...b.filter((v): v is number => v != null)];
  let lo = Math.min(...all), hi = Math.max(...all);
  if (lo === hi) { lo -= 1; hi += 1; }
  pdf.setDrawColor(180); pdf.rect(x, y, w, h);
  pdf.setFontSize(7); pdf.setFont("helvetica", "normal");
  pdf.text(String(hi), x + 1, y + 3); pdf.text(String(lo), x + 1, y + h - 1);
  const px = (i: number, n: number) => x + 8 + (n === 1 ? 0 : (i / (n - 1)) * (w - 12));
  const py = (v: number) => y + h - 3 - ((v - lo) / (hi - lo)) * (h - 6);
  const draw = (vals: (number | null)[], rgb: [number, number, number]) => {
    pdf.setDrawColor(...rgb); pdf.setLineWidth(0.5);
    let prev: [number, number] | null = null;
    vals.forEach((v, i) => {
      if (v == null) { prev = null; return; }
      const p: [number, number] = [px(i, vals.length), py(v)];
      if (prev) pdf.line(prev[0], prev[1], p[0], p[1]);
      pdf.circle(p[0], p[1], 0.7, "F");
      prev = p;
    });
    pdf.setLineWidth(0.2);
  };
  draw(a, [46, 125, 90]);
  if (b.some((v) => v != null)) draw(b, [110, 110, 110]);
}
