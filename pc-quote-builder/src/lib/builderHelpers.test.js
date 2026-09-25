import { describe, expect, it } from "vitest";
import {
  getNextStep,
  isStepDone,
  builderComplete,
} from "./builderHelpers";

describe("getNextStep", () => {
  it("advances when current step matches and has value", () => {
    expect(getNextStep(0, "cpuId", true)).toBe(1);
  });

  it("stays when current step matches but no value", () => {
    expect(getNextStep(0, "cpuId", false)).toBe(0);
  });

  it("stays when step does not match key", () => {
    expect(getNextStep(2, "cpuId", true)).toBe(2);
  });

  it("does not advance past last step", () => {
    expect(getNextStep(5, "caseId", true)).toBe(5);
  });
});

describe("isStepDone", () => {
  it("returns truthy when builder has value for non-GPU step", () => {
    expect(isStepDone({ cpuId: "cpu-1" }, "cpuId")).toBeTruthy();
  });

  it("returns falsy when builder is empty for non-GPU step", () => {
    expect(isStepDone({ cpuId: "" }, "cpuId")).toBeFalsy();
  });

  it("returns truthy for GPU step when gpuId is set", () => {
    expect(isStepDone({ gpuId: "gpu-1", useIntegratedGpu: false }, "gpuId")).toBeTruthy();
  });

  it("returns truthy for GPU step when useIntegratedGpu is true", () => {
    expect(isStepDone({ gpuId: "", useIntegratedGpu: true }, "gpuId")).toBeTruthy();
  });

  it("returns falsy for GPU step when neither gpuId nor integrated", () => {
    expect(isStepDone({ gpuId: "", useIntegratedGpu: false }, "gpuId")).toBeFalsy();
  });

  it("returns false for null builder", () => {
    expect(isStepDone(null, "cpuId")).toBe(false);
  });

  it("returns false for undefined builder", () => {
    expect(isStepDone(undefined, "cpuId")).toBe(false);
  });
});

describe("builderComplete", () => {
  it("returns true when all steps are done", () => {
    expect(builderComplete({
      cpuId: "c", moboId: "m", ramId: "r", gpuId: "g", psuId: "p", caseId: "k",
      useIntegratedGpu: false,
    })).toBe(true);
  });

  it("returns true with integrated GPU", () => {
    expect(builderComplete({
      cpuId: "c", moboId: "m", ramId: "r", gpuId: "", psuId: "p", caseId: "k",
      useIntegratedGpu: true,
    })).toBe(true);
  });

  it("returns false when a step is missing", () => {
    expect(builderComplete({
      cpuId: "c", moboId: "", ramId: "", gpuId: "", psuId: "", caseId: "",
      useIntegratedGpu: false,
    })).toBe(false);
  });

  it("returns false for null builder", () => {
    expect(builderComplete(null)).toBe(false);
  });

  it("returns false for undefined builder", () => {
    expect(builderComplete(undefined)).toBe(false);
  });
});
