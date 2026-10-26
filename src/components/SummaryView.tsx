import type { ReactNode } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SUMMARY_FOOTER, SRC_CALC, SRC_YOU, type SummaryDoc } from "@/lib/summary";

/** Same layout and labels as the PDF. Used in-app (preview) and on the shared doctor link. */
export function SummaryView({ doc }: { doc: SummaryDoc }) {
  const g = doc.glance;
  return (
    <article className="space-y-6 text-base">
      <header className="rounded-2xl border bg-card p-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Patient summary · At a glance</p>
        <h1 className="mt-1 text-2xl font-bold">{g.name ?? "Name not given"}</h1>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          <Item label="Age group" value={g.ageGroup ?? "Not given"} src={SRC_YOU} />
          <Item label="Date range" value={`${doc.range.from} to ${doc.range.to}`} src={SRC_YOU} />
          <Item label="Doctor's Plan used" value={g.plan ? `Version ${g.plan.version} (${g.plan.date})` : "None saved"} src={SRC_YOU} />
          <Item label="Allergies" value={g.allergies ?? "None entered"} src={SRC_YOU} />
          <Item label="Doses not marked" value={String(g.counts.notMarked)} src={SRC_CALC} />
          <Item label="Doses skipped" value={String(g.counts.skipped)} src={SRC_CALC} />
          <Item label="Doses taken late" value={String(g.counts.late)} src={SRC_CALC} />
          <Item label="Most-logged symptoms" value={g.topSymptoms.length ? g.topSymptoms.map((s) => `${s.name} (${s.count})`).join(", ") : "None logged"} src={SRC_CALC} />
        </dl>
        <h2 className="mt-4 font-semibold">Current medicines</h2>
        <Table head={["Medicine", "Dose", "Taken (incl. late) / due", "Adherence", "Source"]}
          rows={g.medicines.map((m) => [m.name, m.detail || "-", `${m.taken + m.late} / ${m.due}`, m.adherencePct == null ? "-" : `${m.adherencePct}%`, `name: ${SRC_YOU}; counts: ${SRC_CALC}`])}
          empty="No current medicines." />
      </header>

      {doc.doses && <Section title="Dose log" src={`times: ${SRC_YOU} (medicine schedule); status: ${SRC_YOU}`}>
        <Table head={["Date", "Time", "Medicine", "Status"]} rows={doc.doses.map((d) => [d.date, d.time, d.medicine, d.status])} empty="No doses due in this range." />
      </Section>}

      {doc.timeline && <Section title="Unwell checks and diary" src={`entries: ${SRC_YOU}; check result: ${SRC_CALC} by CareBuddy's fixed checklist`}>
        <Table head={["Date", "Time", "Type", "Details", "Severity (0-10)", "Result"]}
          rows={doc.timeline.map((t) => [t.date, t.time, t.kind, t.text, t.severity == null ? "-" : String(t.severity), t.result])} empty="Nothing logged in this range." />
      </Section>}

      {doc.meals && <Section title="Meals" src={`meals: ${SRC_YOU}; counts: ${SRC_CALC}`}>
        <p>Total meals logged: <strong>{doc.meals.total}</strong>{doc.meals.byType.length > 0 && ` (${doc.meals.byType.map((b) => `${b.type}: ${b.count}`).join(", ")})`}</p>
        <Table head={["Date", "Time", "Meal", "What was eaten"]} rows={doc.meals.rows.map((m) => [m.date, m.time, m.type, m.description])} empty="No meals logged in this range." />
      </Section>}

      {doc.numbers && <Section title="My numbers" src={`readings: ${SRC_YOU}`}>
        {doc.numbers.length === 0 && <p className="text-muted-foreground">No readings in this range.</p>}
        {doc.numbers.map((n) => (
          <div key={n.kind} className="mt-3">
            <h3 className="font-semibold">{n.label} ({n.unit})</h3>
            {n.rows.length > 1 && (
              <div className="mt-2 h-44" aria-hidden>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={n.rows.map((r) => ({ d: r.date.slice(5), v: r.value, v2: r.value2 }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="d" fontSize={12} /><YAxis fontSize={12} width={40} domain={["auto", "auto"]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="v" stroke="var(--primary)" strokeWidth={2} dot />
                    {n.kind === "blood_pressure" && <Line type="monotone" dataKey="v2" stroke="var(--muted-foreground)" strokeWidth={2} dot />}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <Table head={["Date", "Time", n.kind === "temperature" ? "Value (as entered)" : `Value (${n.unit})`, "Source"]}
              rows={n.rows.map((r) => [r.date, r.time, r.converted ? <>{r.display} <span className="text-xs text-muted-foreground">{r.converted}</span></> : r.display, r.source])} />
          </div>
        ))}
      </Section>}

      {doc.waterSleep && <Section title="Water and sleep" src={`glasses and hours: ${SRC_YOU}; averages: ${SRC_CALC}`}>
        <p>Average water on days logged: <strong>{doc.waterSleep.avgWater ?? "-"}</strong> glasses · Average sleep: <strong>{doc.waterSleep.avgSleep ?? "-"}</strong> hours</p>
        <Table head={["Date", "Water (glasses)", "Goal (glasses)", "Sleep (hours)"]}
          rows={doc.waterSleep.days.map((d) => [d.date, String(d.glasses), d.goal == null ? "-" : String(d.goal), d.sleep == null ? "-" : String(d.sleep)])} empty="Nothing logged in this range." />
      </Section>}

      {doc.appointments && <Section title="Appointments" src={SRC_YOU}>
        <Table head={["Date", "Time", "Doctor", "Purpose", "Place"]} rows={doc.appointments.map((a) => [a.date, a.time, a.doctor, a.purpose, a.location])} empty="No appointments in this range." />
      </Section>}

      {doc.questions && <Section title="Questions for my doctor" src={SRC_YOU}>
        {doc.questions.length ? <ol className="list-decimal space-y-1 pl-6">{doc.questions.map((q, i) => <li key={i}>{q}</li>)}</ol> : <p className="text-muted-foreground">No questions added.</p>}
      </Section>}

      <footer className="rounded-2xl border bg-muted p-4 text-sm">
        <p>Generated {doc.generatedAtLabel}. Dates are YYYY-MM-DD; times are India time.</p>
        <p className="mt-1 font-semibold">{SUMMARY_FOOTER}</p>
      </footer>
    </article>
  );
}

function Item({ label, value, src }: { label: string; value: string; src: string }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label} <span className="italic">({src})</span></dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function Section({ title, src, children }: { title: string; src: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-sm italic text-muted-foreground">Source: {src}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Table({ head, rows, empty }: { head: string[]; rows: ReactNode[][]; empty?: string }) {
  if (!rows.length) return <p className="mt-2 text-muted-foreground">{empty ?? "Nothing here."}</p>;
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full min-w-[28rem] border-collapse text-sm">
        <thead><tr>{head.map((h) => <th key={h} className="border-b p-2 text-left font-semibold">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-b last:border-0">{r.map((c, j) => <td key={j} className="p-2 align-top">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
