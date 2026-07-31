import { describe, expect, it } from "vitest";
import {
  builderReducer,
  BUILDER_STEPS,
  EMPTY_BUILDER,
  SELECT,
  TOGGLE_INTEGRATED_GPU,
  CLEAR,
  LOAD,
  SET_STEP,
  getNextStep,
  isStepDone,
  builderComplete,
} from "./builderReducer";

const initialState = { builder: { ...EMPTY_BUILDER }, step: 0 };

describe("builderReducer", () => {
  it("returns initial state for unknown action", () => {
    expect(builderReducer(initialState, { type: "UNKNOWN" })).toBe(initialState);
  });

  it("handles SELECT action", () => {
    const state = builderReducer(initialState, { type: SELECT, key: "cpuId", value: "cpu-1" });
    expect(state.builder.cpuId).toBe("cpu-1");
    expect(state.step).toBe(0);
  });

  it("handles SELECT with empty value", () => {
    const withCpu = builderReducer(initialState, { type: SELECT, key: "cpuId", value: "cpu-1" });
    const cleared = builderReducer(withCpu, { type: SELECT, key: "cpuId", value: "" });
    expect(cleared.builder.cpuId).toBe("");
  });

  it("handles TOGGLE_INTEGRATED_GPU on", () => {
    const state = builderReducer(initialState, { type: TOGGLE_INTEGRATED_GPU, checked: true });
    expect(state.builder.useIntegratedGpu).toBe(true);
    expect(state.builder.gpuId).toBe("");
  });

  it("handles TOGGLE_INTEGRATED_GPU off", () => {
    const withGpu = builderReducer(initialState, { type: SELECT, key: "gpuId", value: "gpu-1" });
    const toggled = builderReducer(withGpu, { type: TOGGLE_INTEGRATED_GPU, checked: false });
    expect(toggled.builder.useIntegratedGpu).toBe(false);
    expect(toggled.builder.gpuId).toBe("gpu-1");
  });

  it("handles CLEAR action", () => {
    const filled = {
      builder: { ...EMPTY_BUILDER, cpuId: "cpu-1", gpuId: "gpu-1", useIntegratedGpu: true },
      step: 3,
    };
    const cleared = builderReducer(filled, { type: CLEAR });
    expect(cleared.builder).toEqual(EMPTY_BUILDER);
    expect(cleared.step).toBe(0);
  });

  it("handles LOAD action", () => {
    const loaded = builderReducer(initialState, {
      type: LOAD,
      builder: { cpuId: "cpu-1", moboId: "mobo-1" },
    });
    expect(loaded.builder.cpuId).toBe("cpu-1");
    expect(loaded.builder.moboId).toBe("mobo-1");
    expect(loaded.builder.gpuId).toBe("");
    expect(loaded.step).toBe(0);
  });

  it("handles SET_STEP action", () => {
    const state = builderReducer(initialState, { type: SET_STEP, step: 3 });
    expect(state.step).toBe(3);
  });

  it("clamps SET_STEP to valid range", () => {
    const negative = builderReducer(initialState, { type: SET_STEP, step: -1 });
    expect(negative.step).toBe(0);

    const over = builderReducer(initialState, { type: SET_STEP, step: 999 });
    expect(over.step).toBe(BUILDER_STEPS.length - 1);
  });
});

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
