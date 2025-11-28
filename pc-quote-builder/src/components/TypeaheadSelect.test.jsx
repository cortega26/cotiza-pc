/* @vitest-environment jsdom */

import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TypeaheadSelect from "./TypeaheadSelect";

afterEach(() => cleanup());

describe("TypeaheadSelect", () => {
  const options = [
    { id: "1", name: "Ryzen 5 7600" },
    { id: "2", name: "Core i5-13600K" },
  ];

  it("allows selecting with keyboard navigation", () => {
    const handleChange = vi.fn();
    render(<TypeaheadSelect options={options} value="" onChange={handleChange} placeholder="CPU" />);
    const input = screen.getByRole("combobox");

    input.focus();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(handleChange).toHaveBeenCalledWith("1");
  });

  it("closes and clears highlight on escape", () => {
    const handleChange = vi.fn();
    render(<TypeaheadSelect options={options} value="" onChange={handleChange} placeholder="CPU" />);
    const input = screen.getByRole("combobox");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Escape" });

    fireEvent.keyDown(input, { key: "Enter" }); // should not select after escape
    expect(handleChange).not.toHaveBeenCalled();
  });

  it("filters by multiple terms in any order", () => {
    render(
      <TypeaheadSelect
        options={[
          { id: "1", name: "ASUS Prime B550M DDR4" },
          { id: "2", name: "MSI B650 DDR5" },
        ]}
        value=""
        onChange={() => {}}
        placeholder="Placa madre"
      />
    );
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "asus ddr4" } });

    const items = screen.getAllByRole("option");
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toContain("ASUS Prime B550M DDR4");
  });
});
