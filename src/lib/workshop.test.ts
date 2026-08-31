import { describe, expect, it } from "vitest";
import { INSPECTION_CHECKLIST, inspectionLabel, isInspectionKey, workshopTaskCostDelta } from "./workshop";

describe("workshop domain", () => {
  it("contains every mandatory inspection point exactly once", () => {
    expect(INSPECTION_CHECKLIST).toHaveLength(13);
    expect(new Set(INSPECTION_CHECKLIST.map(([key]) => key)).size).toBe(13);
    expect(inspectionLabel("front_brake")).toBe("Voorrem");
    expect(isInspectionKey("charger")).toBe(true);
    expect(isInspectionKey("unknown")).toBe(false);
  });

  it("calculates parts, labour and minutes in integer cents", () => {
    expect(workshopTaskCostDelta({ partCostCents: 1_299, quantity: 2, labourMinutes: 45, labourCostCents: 3_750 })).toEqual({
      partsCents: 2_598,
      labourCents: 3_750,
      labourMinutes: 45,
    });
  });

  it("does not invent costs for a checklist item without work", () => {
    expect(workshopTaskCostDelta({ partCostCents: null, quantity: 1, labourMinutes: null, labourCostCents: null })).toEqual({
      partsCents: 0,
      labourCents: 0,
      labourMinutes: 0,
    });
  });
});
