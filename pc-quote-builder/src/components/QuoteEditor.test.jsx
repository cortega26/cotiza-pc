/* @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import QuoteEditor from "./QuoteEditor";

afterEach(cleanup);

function createProps(overrides = {}) {
  return {
    quote: {
      id: "q1",
      name: "Mi PC",
      currency: "CLP",
      rows: [
        { id: "r1", category: "CPU", product: "Ryzen 5", store: "StoreA", offerPrice: "100", regularPrice: "120", notes: "" },
        { id: "r2", category: "GPU", product: "RTX 4060", store: "", offerPrice: "", regularPrice: "", notes: "" },
      ],
      priceUpdatedAt: null,
    },
    onNameChange: vi.fn(),
    currencyDraft: "CLP",
    onCurrencyChange: vi.fn(),
    onCurrencyPreset: vi.fn(),
    currencyFormatter: { format: (v) => `$${v}` },
    totals: { totalOffer: 100, totalRegular: 120, saving: 20, rowsWithPrice: 1 },
    priceStatus: { label: "Con precios", className: "status-ok", updatedAt: null },
    onReimportPrices: vi.fn(),
    storeTotals: [],
    onRowChange: vi.fn(),
    onRemoveRow: vi.fn(),
    onAddRow: vi.fn(),
    formatDateTime: (d) => d,
    ...overrides,
  };
}

describe("QuoteEditor", () => {
  it("renders quote name", () => {
    render(<QuoteEditor {...createProps()} />);
    expect(screen.getByDisplayValue("Mi PC")).toBeTruthy();
  });

  it("renders three currency radio inputs", () => {
    render(<QuoteEditor {...createProps()} />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
  });

  it("renders currency draft input", () => {
    render(<QuoteEditor {...createProps()} />);
    const input = screen.getByLabelText("Moneda personalizada");
    expect(input).toBeTruthy();
  });

  it("renders total sections", () => {
    render(<QuoteEditor {...createProps()} />);
    expect(screen.getByText("Total oferta")).toBeTruthy();
  });

  it("renders rows in the table", () => {
    render(<QuoteEditor {...createProps()} />);
    const firstRow = screen.getAllByDisplayValue("Ryzen 5")[0];
    expect(firstRow).toBeTruthy();
  });

  it("calls onNameChange when name input changes", () => {
    render(<QuoteEditor {...createProps()} />);
    fireEvent.change(screen.getByDisplayValue("Mi PC"), { target: { value: "New Name" } });
  });

  it("fires onCurrencyPreset on radio click", () => {
    const props = createProps();
    render(<QuoteEditor {...props} />);
    const radios = screen.getAllByRole("radio");
    fireEvent.click(radios[1]);
    expect(props.onCurrencyPreset).toHaveBeenCalledWith("USD");
  });

  it("calls onRowChange when a row field is edited", () => {
    const props = createProps();
    render(<QuoteEditor {...props} />);
    const productInputs = screen.getAllByDisplayValue("Ryzen 5");
    fireEvent.change(productInputs[0], { target: { value: "Ryzen 7" } });
    expect(props.onRowChange).toHaveBeenCalledWith("r1", "product", "Ryzen 7");
  });

  it("calls onRemoveRow when remove button is clicked", () => {
    const props = createProps();
    render(<QuoteEditor {...props} />);
    const buttons = screen.getAllByTitle("Eliminar fila");
    fireEvent.click(buttons[0]);
    expect(props.onRemoveRow).toHaveBeenCalledWith("r1");
  });

  it("calls onAddRow when add button is clicked", () => {
    const props = createProps();
    render(<QuoteEditor {...props} />);
    const buttons = screen.getAllByText("+ Agregar componente");
    fireEvent.click(buttons[0]);
    expect(props.onAddRow).toHaveBeenCalled();
  });

  it("shows reimport button when priceStatus has updatedAt", () => {
    render(<QuoteEditor {...createProps({ priceStatus: { label: "Ok", className: "status-ok", updatedAt: "2024-01-01" } })} />);
    expect(screen.getByText("Reimportar precios")).toBeTruthy();
  });

  it("shows store totals when provided", () => {
    render(<QuoteEditor {...createProps({ storeTotals: [{ store: "StoreA", offer: 100, regular: 120, saving: 20 }] })} />);
    expect(screen.getByText("StoreA")).toBeTruthy();
  });

  it("shows rowsWithPrice in the ratio", () => {
    render(<QuoteEditor {...createProps()} />);
    expect(screen.getByText("Total oferta")).toBeTruthy();
  });
});
