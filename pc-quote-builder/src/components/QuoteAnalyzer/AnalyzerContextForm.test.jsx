/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import AnalyzerContextForm from "./AnalyzerContextForm";
import { ANALYZER_CONTEXT_DEFAULT } from "./session";

afterEach(() => cleanup());

function StatefulForm({ initial = {}, onChange = () => {} }) {
  const [context, setContext] = useState({ ...ANALYZER_CONTEXT_DEFAULT, ...initial });
  return (
    <AnalyzerContextForm
      context={context}
      onChange={(next) => {
        setContext(next);
        onChange(next);
      }}
    />
  );
}

function renderForm(context = {}, onChange = vi.fn()) {
  return render(
    <AnalyzerContextForm
      context={{ ...ANALYZER_CONTEXT_DEFAULT, ...context }}
      onChange={onChange}
    />
  );
}

describe("AnalyzerContextForm", () => {
  it("renders resolution, scope, integrated-GPU, and budget fields", () => {
    renderForm();
    expect(screen.getByText("Resolución objetivo")).toBeTruthy();
    expect(screen.getByText("Alcance del presupuesto")).toBeTruthy();
    expect(screen.getByText("¿GPU dedicada o gráficos integrados?")).toBeTruthy();
    expect(screen.getByLabelText("Presupuesto (informativo, opcional)")).toBeTruthy();
    expect(screen.getByText("CLP")).toBeTruthy();
  });

  it("emits resolution changes", () => {
    const onChange = vi.fn();
    renderForm({}, onChange);
    fireEvent.change(screen.getByLabelText("Resolución objetivo"), { target: { value: "1440p" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ targetResolution: "1440p" })
    );
  });

  it("emits integrated-GPU changes as booleans or null", () => {
    const onChange = vi.fn();
    render(<StatefulForm onChange={onChange} />);
    const dedicated = screen.getByLabelText("Usaré una GPU dedicada (o la incluyo en la cotización)");
    const integrated = screen.getByLabelText("Usaré los gráficos integrados del procesador");
    const unsure = screen.getByLabelText("No estoy seguro(a) todavía");

    expect(unsure.checked).toBe(true);
    fireEvent.click(dedicated);
    expect(dedicated.checked).toBe(true);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ usesIntegratedGpu: false }));

    fireEvent.click(integrated);
    expect(integrated.checked).toBe(true);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ usesIntegratedGpu: true }));

    fireEvent.click(unsure);
    expect(unsure.checked).toBe(true);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ usesIntegratedGpu: null }));
  });

  it("emits budget amount and currency changes", () => {
    const onChange = vi.fn();
    renderForm({}, onChange);
    fireEvent.change(screen.getByLabelText("Presupuesto (informativo, opcional)"), {
      target: { value: "1200000" },
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ budget: expect.objectContaining({ amount: "1200000" }) })
    );
    fireEvent.change(screen.getByLabelText("Moneda del presupuesto"), {
      target: { value: "USD" },
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ budget: expect.objectContaining({ currency: "USD" }) })
    );
  });

  it("emits scope changes", () => {
    const onChange = vi.fn();
    renderForm({}, onChange);
    fireEvent.change(screen.getByLabelText("Alcance del presupuesto"), {
      target: { value: "upgrade" },
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ assemblyScope: "upgrade" }));
  });

  it("shows a hint when the context is incomplete", () => {
    renderForm({}, () => {});
    expect(screen.getByText(/necesitas indicar la resolución objetivo/)).toBeTruthy();
  });

  it("does not show the hint when the context is valid", () => {
    renderForm({ targetResolution: "1080p", usesIntegratedGpu: true }, () => {});
    expect(screen.queryByText(/necesitas indicar la resolución objetivo/)).toBeNull();
  });

  it("disables all controls when disabled", () => {
    const { container } = render(
      <AnalyzerContextForm context={{ ...ANALYZER_CONTEXT_DEFAULT, targetResolution: "1080p" }} onChange={() => {}} disabled />
    );
    expect(container.querySelectorAll("input:disabled, select:disabled, fieldset:disabled").length).toBeGreaterThan(0);
  });
});
