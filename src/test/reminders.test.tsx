import { describe, expect, it } from "vitest";
import { adherence, canUndo, inQuietHours, istDate, SECOND_REMINDER_MIN } from "@/lib/time";
import { medicineSchema } from "@/lib/validation";

// 22:30 India time = 17:00 UTC
const at = (utc: string) => new Date(`2026-10-26T${utc}:00Z`);

describe("reminder rules", () => {
  it("second reminder waits 15 minutes", () => {
    expect(SECOND_REMINDER_MIN).toBe(15);
  });
  it("undo is allowed within 5 minutes", () => {
    const now = new Date("2026-10-26T10:05:00Z");
    expect(canUndo("2026-10-26T10:00:30Z", now)).toBe(true);
  });
  it("undo is refused after 5 minutes", () => {
    const now = new Date("2026-10-26T10:05:01Z");
    expect(canUndo("2026-10-26T10:00:00Z", now)).toBe(false);
  });
  it("quiet hours crossing midnight cover 22:30 India time", () => {
    expect(inQuietHours(at("17:00"), "22:00", "07:00")).toBe(true);
  });
  it("quiet hours crossing midnight do not cover 08:00 India time", () => {
    expect(inQuietHours(at("02:30"), "22:00", "07:00")).toBe(false);
  });
  it("India date rolls over at 18:30 UTC", () => {
    expect(istDate(new Date("2026-10-26T18:31:00Z"))).toBe("2026-10-27");
  });
  it("weekly adherence counts taken and late, ignores future doses", () => {
    const now = new Date("2026-10-26T12:00:00Z");
    const doses = [
      { scheduled_at: "2026-10-26T02:30:00Z", status: "taken" },
      { scheduled_at: "2026-10-26T03:30:00Z", status: "late" },
      { scheduled_at: "2026-10-26T04:30:00Z", status: "skipped" },
      { scheduled_at: "2026-10-26T05:30:00Z", status: "pending" },
      { scheduled_at: "2026-10-26T20:00:00Z", status: "pending" },
    ];
    expect(adherence(doses, now)).toBe(50);
  });
});

describe("medicine validation", () => {
  const base = { name: "X", times: ["08:00"], food: "any", start_date: "2026-10-26" };
  it("needs at least one time", () => {
    expect(medicineSchema.safeParse({ ...base, times: [] }).success).toBe(false);
  });
  it("rejects the same time twice", () => {
    expect(medicineSchema.safeParse({ ...base, times: ["08:00", "08:00"] }).success).toBe(false);
  });
  it("rejects an end date before the start date", () => {
    expect(medicineSchema.safeParse({ ...base, end_date: "2026-10-01" }).success).toBe(false);
  });
});
