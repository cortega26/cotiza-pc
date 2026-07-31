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

  it("keeps the selected label synchronized with an externally updated value", () => {
    const { rerender } = render(
      <TypeaheadSelect options={options} value="1" onChange={() => {}} placeholder="CPU" />
    );
    const input = screen.getByRole("combobox");

    expect(input.value).toBe("Ryzen 5 7600");

    rerender(<TypeaheadSelect options={options} value="2" onChange={() => {}} placeholder="CPU" />);
    expect(input.value).toBe("Core i5-13600K");
  });

  it("clears a stale keyboard highlight when filtering removes that option", () => {
    render(<TypeaheadSelect options={options} value="" onChange={() => {}} placeholder="CPU" />);
    const input = screen.getByRole("combobox");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.change(input, { target: { value: "Ryzen" } });

    expect(screen.getByRole("option").getAttribute("aria-selected")).toBe("false");
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

  it("renders no options when the list is empty", () => {
    render(<TypeaheadSelect options={[]} value="" onChange={() => {}} placeholder="CPU" />);
    fireEvent.focus(screen.getByRole("combobox"));
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });

  it("shows no options when no item matches the filter", () => {
    render(<TypeaheadSelect options={options} value="" onChange={() => {}} placeholder="CPU" />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "zzznonexistent" } });
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });

  it("selects an option by mouse click", () => {
    const handleChange = vi.fn();
    render(<TypeaheadSelect options={options} value="" onChange={handleChange} placeholder="CPU" />);
    fireEvent.focus(screen.getByRole("combobox"));
    fireEvent.click(screen.getAllByRole("option")[0]);
    expect(handleChange).toHaveBeenCalledWith("1");
  });

  it("closes the list when clicking outside the component", () => {
    render(<TypeaheadSelect options={options} value="" onChange={() => {}} placeholder="CPU" />);
    fireEvent.focus(screen.getByRole("combobox"));
    expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
    fireEvent.mouseDown(document.body);
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });

  it("resets input to selected label on re-focus after editing", () => {
    const handleChange = vi.fn();
    render(<TypeaheadSelect options={options} value="1" onChange={handleChange} placeholder="CPU" />);
    const input = screen.getByRole("combobox");

    expect(input.value).toBe("Ryzen 5 7600");

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "custom text" } });
    fireEvent.mouseDown(document.body);
    fireEvent.focus(input);

    expect(input.value).toBe("Ryzen 5 7600");
  });

  it("calls onChange with empty string when the input is cleared", () => {
    const handleChange = vi.fn();
    render(<TypeaheadSelect options={options} value="1" onChange={handleChange} placeholder="CPU" />);
    fireEvent.focus(screen.getByRole("combobox"));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "" } });
    expect(handleChange).toHaveBeenCalledWith("");
  });

  it("respects the maxItems limit", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: String(i), name: `Item ${i}` }));
    render(
      <TypeaheadSelect options={many} value="" onChange={() => {}} placeholder="CPU" maxItems={5} />
    );
    fireEvent.focus(screen.getByRole("combobox"));
    expect(screen.getAllByRole("option")).toHaveLength(5);
  });

  it("wraps highlighted index to the last option on arrow-up at index 0", () => {
    render(<TypeaheadSelect options={options} value="" onChange={() => {}} placeholder="CPU" />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowUp" });

    const items = screen.getAllByRole("option");
    expect(items[items.length - 1].getAttribute("aria-selected")).toBe("true");
  });

  it("does not crash when an option has no label (getOptionLabel returns undefined)", () => {
    render(
      <TypeaheadSelect
        options={[{ id: "1" }, { id: "2", name: "Ryzen 5 7600" }]}
        value=""
        onChange={() => {}}
        placeholder="CPU"
        getOptionLabel={(opt) => opt.name}
      />
    );
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "ryzen" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByText(/Ryzen 5 7600/)).toBeTruthy();
  });

  it("shows the first option when ids are duplicated", () => {
    render(
      <TypeaheadSelect
        options={[
          { id: "dup", name: "First" },
          { id: "dup", name: "Second" },
        ]}
        value="dup"
        onChange={() => {}}
        placeholder="CPU"
      />
    );
    expect(screen.getByRole("combobox").value).toBe("First");
  });

  it("renders no options when maxItems is zero", () => {
    render(<TypeaheadSelect options={options} value="" onChange={() => {}} placeholder="CPU" maxItems={0} />);
    fireEvent.focus(screen.getByRole("combobox"));
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });

  it("clamps a negative maxItems to zero", () => {
    render(<TypeaheadSelect options={options} value="" onChange={() => {}} placeholder="CPU" maxItems={-5} />);
    fireEvent.focus(screen.getByRole("combobox"));
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });

  it("returns the first maxItems matches in catalog order", () => {
    const many = Array.from({ length: 100 }, (_, i) => ({ id: String(i), name: `Item ${i}` }));
    render(<TypeaheadSelect options={many} value="" onChange={() => {}} placeholder="CPU" maxItems={5} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Item 1" } });

    const items = screen.getAllByRole("option");
    expect(items.map((el) => el.textContent)).toEqual(["Item 1", "Item 10", "Item 11", "Item 12", "Item 13"]);
  });

  it("stays correct when getOptionLabel identity changes between renders", () => {
    const { rerender } = render(
      <TypeaheadSelect options={options} value="" onChange={() => {}} placeholder="CPU" getOptionLabel={(opt) => opt.name} />
    );
    rerender(
      <TypeaheadSelect options={options} value="" onChange={() => {}} placeholder="CPU" getOptionLabel={(opt) => opt.name} />
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "ryzen" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
  });
});
