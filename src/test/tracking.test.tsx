import { describe, it, expect } from "vitest";
import { applyDoseToStock, daysOfSupply, supplyStatus, streak, weeklyInsights, questionsFromDiary } from "@/lib/tracking";

// 12:00 India time on 2026-10-20 = 06:30 UTC
const NOW = new Date("2026-10-20T06:30:00Z");
const at = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00+05:30`).toISOString();

describe("refill count", () => {
  it("Taken uses tablets per dose", () => expect(applyDoseToStock(10, 2, "pending", "taken")).toEqual({ remaining: 8, deducted: 2 }));
  it("Late also uses tablets", () => expect(applyDoseToStock(10, 1, "pending", "late").remaining).toBe(9));
  it("Undo restores exactly what was used", () => expect(applyDoseToStock(8, 2, "taken", "pending", 2)).toEqual({ remaining: 10, deducted: 0 }));
  it("never goes below zero, and restores only what was taken", () => {
    const a = applyDoseToStock(1, 2, "pending", "taken");
    expect(a).toEqual({ remaining: 0, deducted: 1 });
    expect(applyDoseToStock(a.remaining, 2, "taken", "pending", a.deducted).remaining).toBe(1);
  });
  it("Skipped does not use tablets", () => expect(applyDoseToStock(10, 1, "pending", "skipped").remaining).toBe(10));
  it("untracked medicines stay untracked", () => expect(applyDoseToStock(null, 1, "pending", "taken").remaining).toBeNull());
  it("5 days left is low, 6 is not, 0 is out", () => {
    expect(daysOfSupply(10, 1, 2)).toBe(5);
    expect(supplyStatus(10, 1, 2)).toBe("low");
    expect(supplyStatus(12, 1, 2)).toBe("ok");
    expect(supplyStatus(0, 1, 2)).toBe("out");
    expect(supplyStatus(null, 1, 2)).toBe("untracked");
  });
});

describe("streak", () => {
  const day = (d: string, statuses: string[]) => statuses.map((s, i) => ({ scheduled_at: at(d, `0${8 + i}:00`), status: s }));
  it("counts consecutive full days", () =>
    expect(streak([...day("2026-10-17", ["taken"]), ...day("2026-10-18", ["taken", "late"]), ...day("2026-10-19", ["taken", "taken"])], NOW)).toBe(3));
  it("a day with an unmarked dose ends the streak", () =>
    expect(streak([...day("2026-10-17", ["taken"]), ...day("2026-10-18", ["taken", "pending"]), ...day("2026-10-19", ["taken"])], NOW)).toBe(1));
  it("today in progress does not break it, a skip today resets it", () => {
    expect(streak([...day("2026-10-19", ["taken"]), { scheduled_at: at("2026-10-20", "20:00"), status: "pending" }], NOW)).toBe(1);
    expect(streak([...day("2026-10-19", ["taken"]), ...day("2026-10-20", ["skipped"])], NOW)).toBe(0);
  });
  it("today fully taken counts", () => expect(streak([...day("2026-10-19", ["taken"]), ...day("2026-10-20", ["taken"])], NOW)).toBe(2));
  it("no doses means 0", () => expect(streak([], NOW)).toBe(0));
});

describe("weekly insights", () => {
  const week = Array.from({ length: 7 }, (_, i) => `2026-10-${String(14 + i).padStart(2, "0")}`);
  it("says not enough data with fewer than 7 days", () => {
    const r = weeklyInsights({ now: NOW, doses: [], waterDays: { "2026-10-19": 3 }, sleep: [], symptoms: [] });
    expect(r.enough).toBe(false);
  });
  it("adherence, not-marked by time of day, averages and top symptoms", () => {
    const doses = week.flatMap((d) => [{ scheduled_at: at(d, "08:00"), status: "taken" }, { scheduled_at: at(d, "21:30"), status: d < "2026-10-17" ? "pending" : "taken" }]);
    const r = weeklyInsights({
      now: new Date("2026-10-20T18:00:00Z"), doses,
      waterDays: Object.fromEntries(week.map((d) => [d, 6])),
      sleep: week.map((d) => ({ night: d, hours: 7 })),
      symptoms: [{ occurred_at: at("2026-10-15", "10:00"), symptoms: ["Headache"] }, { occurred_at: at("2026-10-16", "10:00"), symptoms: ["Headache", "Cough"] }],
    });
    if (!r.enough) throw new Error("expected enough");
    expect(r.adherencePct).toBe(79); // 11 of 14
    expect(r.notMarked["night"]).toBe(3);
    expect(r.avgWater).toBe(6);
    expect(r.avgSleep).toBe(7);
    expect(r.topSymptoms[0]).toEqual({ name: "Headache", days: 2 });
    expect(r.patterns).toContain("Most doses left not marked this week were in the night.");
  });
  it("links symptoms to short-sleep days with a plain count", () => {
    const r = weeklyInsights({
      now: NOW, doses: [], waterDays: Object.fromEntries(week.map((d) => [d, 8])),
      sleep: week.map((d, i) => ({ night: d, hours: i < 4 ? 5 : 8 })),
      symptoms: ["2026-10-14", "2026-10-15", "2026-10-16"].map((d) => ({ occurred_at: at(d, "10:00"), symptoms: ["Headache"] })),
    });
    if (!r.enough) throw new Error("expected enough");
    expect(r.patterns[0]).toBe("Headache was logged on 3 of the 4 days you slept under 6 hours.");
    expect(r.patterns.join(" ")).not.toMatch(/should|cause|because|diagnos/i);
  });
});

describe("appointment questions from diary", () => {
  it("uses only symptom names and dates from the last 14 days", () => {
    const q = questionsFromDiary([
      { occurred_at: at("2026-10-18", "09:00"), symptoms: ["Headache"] },
      { occurred_at: at("2026-10-01", "09:00"), symptoms: ["Old cough"] },
    ], NOW);
    expect(q).toEqual(["Headache: 18 Oct"]);
  });
});
