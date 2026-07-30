export const BUILDER_STEPS = [
  { key: "cpuId", label: "CPU" },
  { key: "moboId", label: "Placa madre" },
  { key: "ramId", label: "RAM" },
  { key: "gpuId", label: "GPU" },
  { key: "psuId", label: "Fuente" },
  { key: "caseId", label: "Gabinete" },
];

export const EMPTY_BUILDER = {
  cpuId: "",
  moboId: "",
  ramId: "",
  gpuId: "",
  psuId: "",
  caseId: "",
  useIntegratedGpu: false,
};

export const SELECT = "SELECT";
export const TOGGLE_INTEGRATED_GPU = "TOGGLE_INTEGRATED_GPU";
export const CLEAR = "CLEAR";
export const LOAD = "LOAD";
export const SET_STEP = "SET_STEP";

export function builderReducer(state, action) {
  switch (action.type) {
    case SELECT:
      return { ...state, builder: { ...state.builder, [action.key]: action.value || "" } };
    case TOGGLE_INTEGRATED_GPU:
      return {
        ...state,
        builder: {
          ...state.builder,
          useIntegratedGpu: action.checked,
          gpuId: action.checked ? "" : state.builder.gpuId,
        },
      };
    case CLEAR:
      return { ...state, builder: { ...EMPTY_BUILDER }, step: 0 };
    case LOAD:
      return { ...state, builder: { ...EMPTY_BUILDER, ...action.builder } };
    case SET_STEP:
      return { ...state, step: Math.max(0, Math.min(action.step, BUILDER_STEPS.length - 1)) };
    default:
      return state;
  }
}

export function getNextStep(currentStep, key, hasValue) {
  const idx = BUILDER_STEPS.findIndex((s) => s.key === key);
  if (hasValue && idx === currentStep && currentStep < BUILDER_STEPS.length - 1) {
    return currentStep + 1;
  }
  return currentStep;
}

export function isStepDone(builder, stepKey) {
  return stepKey === "gpuId"
    ? builder.gpuId || builder.useIntegratedGpu
    : builder[stepKey];
}

export function builderComplete(builder) {
  return BUILDER_STEPS.every((step) => isStepDone(builder, step.key));
}
