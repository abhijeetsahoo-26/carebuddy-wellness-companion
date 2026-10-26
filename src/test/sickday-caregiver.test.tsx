import { describe, it, expect } from "vitest";
import { checkinOutcome, dueSickPushes, checkinSchema } from "@/lib/sickday";
import { caregiverCan, shouldAlertCaregiver, inviteUsable, inviteSchema, type GrantLite } from "@/lib/caregiver";
import { checkMealIdeas, avoidTerms } from "@/lib/meal-note";

const ist = (d: string, t: string) => new Date(`${d}T${t}:00+05:30`);

describe("sick-day check-in", () => {
  it("Better offers to end", () => expect(checkinOutcome("better")).toBe("offer_end"));
  it("Same shows the 3-day message", () => expect(checkinOutcome("same")).toBe("contact_if_3_days"));
  it("Worse shows see a doctor soon", () => expect(checkinOutcome("worse")).toBe("doctor_soon"));
  it("any red flag shows EMERGENCY, even with Better", () => expect(checkinOutcome("better", ["breathing"])).toBe("emergency"));
  it("needs an answer or a red flag", () => expect(checkinSchema.safeParse({ answer: null, red_flags: [] }).success).toBe(false));
});

describe("sick-day pushes", () => {
  const s = { id: "s1", started_at: ist("2026-10-20", "08:00").toISOString() };
  it("water every 2 hours while awake", () => {
    expect(dueSickPushes(s, ist("2026-10-20", "09:30"), null, null)).toEqual([]);
    expect(dueSickPushes(s, ist("2026-10-20", "10:05"), null, null)).toEqual([{ kind: "sick_water", key: "sick_water:s1:1" }]);
  });
  it("check-in after 6 hours", () => expect(dueSickPushes(s, ist("2026-10-20", "14:01"), null, null).map((p) => p.key)).toContain("sick_checkin:s1:1"));
  it("nothing at night or in quiet hours", () => {
    expect(dueSickPushes(s, ist("2026-10-20", "23:30"), null, null)).toEqual([]);
    expect(dueSickPushes(s, ist("2026-10-20", "14:30"), "14:00", "16:00")).toEqual([]);
  });
});

describe("meal ideas reply check", () => {
  const ok = "Moong dal khichdi with curd\nVegetable upma with peanuts\nRoti with lauki sabzi";
  it("keeps 3 safe ideas", () => expect(checkMealIdeas(ok)).toHaveLength(3));
  it("discards medicine names", () => expect(checkMealIdeas("Khichdi\nTake paracetamol after\nRoti")).toBeNull());
  it("discards doses", () => expect(checkMealIdeas("Poha with 500 mg of turmeric")).toBeNull());
  it("discards disease claims and cure/treat/prevent", () => {
    expect(checkMealIdeas("Methi roti for diabetes")).toBeNull();
    expect(checkMealIdeas("Ginger tea to prevent colds")).toBeNull();
    expect(checkMealIdeas("Soup that can treat a sore throat")).toBeNull();
  });
  it("discards anything with an allergy or food to avoid", () => expect(checkMealIdeas(ok, [], avoidTerms("Peanuts", "fried food")) ).toBeNull());
  it("discards more than 3 lines", () => expect(checkMealIdeas("a idli\nb dosa\nc upma\nd poha")).toBeNull());
});

describe("caregiver permissions", () => {
  const g: GrantLite = { status: "active", caregiver_id: "cg", can_adherence: true, can_missed_alerts: false, can_appointments: true, alerts_enabled: true };
  it("sees only switched-on categories", () => {
    expect(caregiverCan(g, "cg", "adherence")).toBe(true);
    expect(caregiverCan(g, "cg", "missed")).toBe(false);
    expect(caregiverCan(g, "cg", "appointments")).toBe(true);
  });
  it("never sees diary, meals, numbers or the plan", () => {
    for (const c of ["diary", "meals", "numbers", "doctor_plan"]) expect(caregiverCan({ ...g, can_missed_alerts: true }, "cg", c)).toBe(false);
  });
  it("paused or revoked caregivers see nothing", () => {
    expect(caregiverCan({ ...g, status: "paused" }, "cg", "adherence")).toBe(false);
    expect(caregiverCan({ ...g, status: "revoked" }, "cg", "adherence")).toBe(false);
  });
  it("another user sees nothing", () => expect(caregiverCan(g, "someone-else", "adherence")).toBe(false));
  it("invite works only while invited and within 3 days", () => {
    const now = new Date("2026-10-20T00:00:00Z");
    expect(inviteUsable({ status: "invited", invite_expires_at: "2026-10-22T00:00:00Z" }, now)).toBe(true);
    expect(inviteUsable({ status: "invited", invite_expires_at: "2026-10-19T00:00:00Z" }, now)).toBe(false);
    expect(inviteUsable({ status: "active", invite_expires_at: "2026-10-22T00:00:00Z" }, now)).toBe(false);
    expect(inviteUsable({ status: "cancelled", invite_expires_at: "2026-10-22T00:00:00Z" }, now)).toBe(false);
  });
  it("must share at least one category", () => expect(inviteSchema.safeParse({ label: "Son", can_adherence: false, can_missed_alerts: false, can_appointments: false }).success).toBe(false));
  it("alerts only after 2 hours not marked, and only if both sides allow", () => {
    const now = new Date("2026-10-20T12:00:00Z");
    const a = { ...g, can_missed_alerts: true };
    expect(shouldAlertCaregiver(a, { status: "pending", scheduled_at: "2026-10-20T09:30:00Z" }, now)).toBe(true);
    expect(shouldAlertCaregiver(a, { status: "pending", scheduled_at: "2026-10-20T10:30:00Z" }, now)).toBe(false);
    expect(shouldAlertCaregiver(a, { status: "taken", scheduled_at: "2026-10-20T09:00:00Z" }, now)).toBe(false);
    expect(shouldAlertCaregiver({ ...a, alerts_enabled: false }, { status: "pending", scheduled_at: "2026-10-20T09:00:00Z" }, now)).toBe(false);
    expect(shouldAlertCaregiver({ ...a, status: "paused" }, { status: "pending", scheduled_at: "2026-10-20T09:00:00Z" }, now)).toBe(false);
  });
});
