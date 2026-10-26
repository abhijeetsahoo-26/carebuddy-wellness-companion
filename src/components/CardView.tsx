import { forwardRef } from "react";
import { HeartPulse } from "lucide-react";
import type { PublicCard } from "@/lib/tracking.functions";
import { telHref } from "@/lib/directory";

// Shows only the items present in `card` (the owner's switched-on items).
export const CardView = forwardRef<HTMLDivElement, { card: PublicCard }>(function CardView({ card }, ref) {
  const row = (label: string, value: React.ReactNode) => (
    <div className="border-t py-3 first:border-t-0"><p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><div className="text-lg">{value}</div></div>
  );
  const has = (k: keyof PublicCard) => k in card;
  return (
    <div ref={ref} className="rounded-2xl border-2 border-emergency bg-card p-5 text-card-foreground">
      <p className="flex items-center gap-2 text-xl font-bold text-emergency"><HeartPulse className="size-6" aria-hidden /> Emergency card</p>
      <div className="mt-2">
        {has("name") && row("Name", card.name || "—")}
        {has("allergies") && row("Allergies", <span className="whitespace-pre-wrap">{card.allergies || "None entered"}</span>)}
        {has("conditions") && row("Conditions", <span className="whitespace-pre-wrap">{card.conditions || "None entered"}</span>)}
        {has("medicines") && row("Current medicines", card.medicines?.length ? <ul className="list-disc pl-6">{card.medicines.map((m, i) => <li key={i}>{[m.name, m.strength, m.dose].filter(Boolean).join(" · ")}</li>)}</ul> : "None entered")}
        {has("doctor") && row("Doctor", card.doctor?.name || card.doctor?.phone ? <>{card.doctor?.name}{card.doctor?.phone && <> · <a className="font-semibold underline" href={telHref(card.doctor.phone)}>{card.doctor.phone}</a></>}</> : "None entered")}
        {has("contacts") && row("Emergency contacts", card.contacts?.length ? <ul>{card.contacts.map((c, i) => <li key={i}>{c.name}{c.relationship ? ` (${c.relationship})` : ""} · <a className="font-semibold underline" href={telHref(c.phone)}>{c.phone}</a></li>)}</ul> : "None entered")}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">Entered by the card owner in CareBuddy. In an emergency in India, call 112.</p>
    </div>
  );
});
