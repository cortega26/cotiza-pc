import { isAnalyzerContextValid } from "./session";
import { RESOLUTION_OPTIONS, SCOPE_OPTIONS } from "./labels";

const GPU_OPTIONS = [
  { value: "false", label: "Usaré una GPU dedicada (o la incluyo en la cotización)" },
  { value: "true", label: "Usaré los gráficos integrados del procesador" },
  { value: "null", label: "No estoy seguro(a) todavía" },
];

function AnalyzerContextForm({ context, onChange, disabled = false, onEditContext }) {
  const setPartial = (partial) => onChange?.({ ...context, ...partial });

  const gpuValue = context.usesIntegratedGpu === null ? "null" : String(context.usesIntegratedGpu);
  const budget = context.budget || { amount: "", currency: "CLP" };

  return (
    <div className="analyzer-card">
      <h3>Contexto de tu compra</h3>
      <p className="muted">
        Estos datos no cambian el veredicto técnico en v1, pero son parte de la evaluación.
      </p>
      <div className="context-grid">
        <label className="field">
          <span>Resolución objetivo</span>
          <select
            value={context.targetResolution || ""}
            disabled={disabled}
            onChange={(e) => setPartial({ targetResolution: e.target.value || "" })}
          >
            <option value="">Selecciona una resolución</option>
            {RESOLUTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Alcance del presupuesto</span>
          <select
            value={context.assemblyScope || "unknown"}
            disabled={disabled}
            onChange={(e) => setPartial({ assemblyScope: e.target.value })}
          >
            {SCOPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="field" disabled={disabled}>
        <legend>¿GPU dedicada o gráficos integrados?</legend>
        <div className="radio-group">
          {GPU_OPTIONS.map((opt) => (
            <label key={opt.value} className="radio-option">
              <input
                type="radio"
                name="uses-integrated-gpu"
                value={opt.value}
                checked={gpuValue === opt.value}
                onChange={() =>
                  setPartial({
                    usesIntegratedGpu: opt.value === "null" ? null : opt.value === "true",
                  })
                }
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="context-grid">
        <label className="field">
          <span>Presupuesto (informativo, opcional)</span>
          <input
            type="text"
            inputMode="decimal"
            value={budget.amount}
            disabled={disabled}
            placeholder="Ej: 1200000"
            onChange={(e) =>
              setPartial({ budget: { ...budget, amount: e.target.value } })
            }
          />
        </label>
        <label className="field">
          <span>Moneda del presupuesto</span>
          <select
            value={budget.currency}
            disabled={disabled}
            onChange={(e) => setPartial({ budget: { ...budget, currency: e.target.value } })}
          >
            <option value="CLP">CLP</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </label>
      </div>

      {!isAnalyzerContextValid(context) && (
        <p className="field-hint">
          Para evaluar necesitas indicar la resolución objetivo y confirmar si usarás GPU dedicada o
          gráficos integrados.
        </p>
      )}

      {disabled && onEditContext && (
        <button className="secondary-btn" onClick={onEditContext}>
          Editar contexto
        </button>
      )}
    </div>
  );
}

export default AnalyzerContextForm;
