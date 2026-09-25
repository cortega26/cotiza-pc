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

export function getNextStep(currentStep, key, hasValue) {
  const idx = BUILDER_STEPS.findIndex((s) => s.key === key);
  if (hasValue && idx === currentStep && currentStep < BUILDER_STEPS.length - 1) {
    return currentStep + 1;
  }
  return currentStep;
}

export function isStepDone(builder, stepKey) {
  if (!builder || typeof builder !== "object") return false;
  return stepKey === "gpuId"
    ? builder.gpuId || builder.useIntegratedGpu
    : builder[stepKey];
}

export function builderComplete(builder) {
  if (!builder || typeof builder !== "object") return false;
  return BUILDER_STEPS.every((step) => isStepDone(builder, step.key));
}
