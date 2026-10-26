import { describe, it, expect } from "vitest";
import { decide, type UnwellAnswers } from "@/lib/unwell";

const mild: UnwellAnswers = {
  symptoms: ["cold"], other: "", duration: "under_1", fever: false, temperature_f: null,
  breathing: false, chest_pain: false, gi: "none", fluids_ok: true, pain: 2,
  confusion: false, worsening: false, allergic: false, self_harm: false,
};
const r = (p: Partial<UnwellAnswers>) => decide({ ...mild, ...p }).result;

describe("emergency red flags (each one alone)", () => {
  it("trouble breathing", () => expect(r({ breathing: true })).toBe("emergency"));
  it("chest pain or pressure", () => expect(r({ chest_pain: true })).toBe("emergency"));
  it("confusion, fainting or seizure", () => expect(r({ confusion: true })).toBe("emergency"));
  it("getting worse quickly", () => expect(r({ worsening: true })).toBe("emergency"));
  it("allergic reaction signs", () => expect(r({ allergic: true })).toBe("emergency"));
  it("thoughts of self-harm", () => expect(r({ self_harm: true })).toBe("emergency"));
  it("severe bleeding chosen in symptoms", () => expect(r({ symptoms: ["severe_bleeding"] })).toBe("emergency"));
  it("severe dehydration chosen in symptoms", () => expect(r({ symptoms: ["severe_dehydration"] })).toBe("emergency"));
});

describe("emergency always wins", () => {
  it("over every see-a-doctor reason", () =>
    expect(r({ chest_pain: true, fever: true, temperature_f: 104, duration: "over_3", fluids_ok: false, pain: 9, gi: "6_plus" })).toBe("emergency"));
  it("even when all else is mild, with pain 0", () => expect(r({ pain: 0, allergic: true })).toBe("emergency"));
});

describe("see a doctor soon", () => {
  it("high fever, 102 °F or more", () => { expect(r({ fever: true, temperature_f: 102 })).toBe("doctor_soon"); expect(r({ fever: true, temperature_f: 101.9 })).toBe("self_care"); });
  it("fever longer than 3 days", () => expect(r({ fever: true, duration: "over_3" })).toBe("doctor_soon"));
  it("cannot keep fluids down", () => expect(r({ fluids_ok: false })).toBe("doctor_soon"));
  it("symptoms over 3 days", () => expect(r({ duration: "over_3" })).toBe("doctor_soon"));
  it("pain 7 or more", () => { expect(r({ pain: 7 })).toBe("doctor_soon"); expect(r({ pain: 6 })).toBe("self_care"); });
  it("repeated vomiting or diarrhoea (3 or more times)", () => { expect(r({ gi: "3_5" })).toBe("doctor_soon"); expect(r({ gi: "6_plus" })).toBe("doctor_soon"); expect(r({ gi: "1_2" })).toBe("self_care"); });
});

describe("self-care", () => {
  it("when nothing above applies", () => expect(decide(mild)).toEqual({ result: "self_care", reasons: [] }));
});
