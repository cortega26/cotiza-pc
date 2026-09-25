/* @vitest-environment jsdom */
import { StrictMode } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePersistence } from "./usePersistence";

const Q1 = { id: "q1", name: "Quote 1", rows: [], currency: "CLP" };
const Q2 = { id: "q2", name: "Quote 2", rows: [], currency: "USD" };

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("usePersistence", () => {
  it("initializes with default quote when localStorage is empty", () => {
    const { result } = renderHook(() => usePersistence());
    expect(result.current.quotes).toHaveLength(1);
    expect(result.current.quotes[0].name).toBe("Mi PC actual");
    expect(result.current.activeQuoteId).toBe(result.current.quotes[0].id);
  });

  it("loads quotes from localStorage", () => {
    localStorage.setItem("pcqb:quotes:v1", JSON.stringify([Q1, Q2]));
    const { result } = renderHook(() => usePersistence());
    expect(result.current.quotes).toHaveLength(2);
    expect(result.current.quotes[0].name).toBe("Quote 1");
  });

  it("sets activeQuoteId from localStorage", () => {
    localStorage.setItem("pcqb:quotes:v1", JSON.stringify([Q1, Q2]));
    localStorage.setItem("pcqb:activeQuoteId:v1", "q2");
    const { result } = renderHook(() => usePersistence());
    expect(result.current.activeQuoteId).toBe("q2");
  });

  it("uses first quote when stored activeQuoteId is invalid", () => {
    localStorage.setItem("pcqb:quotes:v1", JSON.stringify([Q1, Q2]));
    localStorage.setItem("pcqb:activeQuoteId:v1", "nonexistent");
    const { result } = renderHook(() => usePersistence());
    expect(result.current.activeQuoteId).toBe("q1");
  });

  it("loads builder from localStorage", () => {
    localStorage.setItem("pcqb:builder:v1", JSON.stringify({ cpuId: "cpu-1" }));
    const { result } = renderHook(() => usePersistence());
    expect(result.current.builder.cpuId).toBe("cpu-1");
  });

  it("syncs quotes to localStorage on change", () => {
    const { result } = renderHook(() => usePersistence());
    const newQuote = { id: "new", name: "New", rows: [], currency: "CLP" };
    act(() => {
      result.current.setQuotes([newQuote]);
    });
    const stored = JSON.parse(localStorage.getItem("pcqb:quotes:v1"));
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe("new");
  });

  it("syncs activeQuoteId to localStorage on change", () => {
    localStorage.setItem("pcqb:quotes:v1", JSON.stringify([Q1, Q2]));
    const { result } = renderHook(() => usePersistence());
    act(() => {
      result.current.setActiveQuoteId("q2");
    });
    expect(localStorage.getItem("pcqb:activeQuoteId:v1")).toBe("q2");
  });

  it("syncs builder to localStorage on change", () => {
    const { result } = renderHook(() => usePersistence());
    act(() => {
      result.current.setBuilder({ cpuId: "new-cpu" });
    });
    const stored = JSON.parse(localStorage.getItem("pcqb:builder:v1"));
    expect(stored.cpuId).toBe("new-cpu");
  });

  it("handles corrupted localStorage gracefully", () => {
    localStorage.setItem("pcqb:quotes:v1", "not-json");
    localStorage.setItem("pcqb:builder:v1", "not-json");
    const { result } = renderHook(() => usePersistence());
    expect(result.current.quotes).toHaveLength(1);
    expect(result.current.builder).toBeDefined();
  });

  it("recovers valid entries from a partially corrupt array without overwriting the blob", () => {
    const raw = JSON.stringify([Q1, null]);
    localStorage.setItem("pcqb:quotes:v1", raw);
    const { result } = renderHook(() => usePersistence());
    expect(result.current.quotes).toHaveLength(1);
    expect(result.current.quotes[0].name).toBe("Quote 1");
    expect(localStorage.getItem("pcqb:quotes:v1")).toBe(raw);
  });

  it("keeps the corrupt blob intact under StrictMode double effects", () => {
    const raw = JSON.stringify([Q1, null]);
    localStorage.setItem("pcqb:quotes:v1", raw);
    renderHook(() => usePersistence(), { wrapper: StrictMode });
    expect(localStorage.getItem("pcqb:quotes:v1")).toBe(raw);
  });

  it("backs up an unreadable blob and shows the fallback", () => {
    localStorage.setItem("pcqb:quotes:v1", "not-json");
    const { result } = renderHook(() => usePersistence());
    expect(result.current.quotes).toHaveLength(1);
    expect(result.current.quotes[0].name).toBe("Mi PC actual");
    expect(localStorage.getItem("pcqb:quotes:v1")).toBe("not-json");
    const backupKeys = Object.keys(localStorage).filter((key) =>
      key.startsWith("pcqb:quotes:v1:backup:")
    );
    expect(backupKeys).toHaveLength(1);
    expect(localStorage.getItem(backupKeys[0])).toBe("not-json");
  });

  it("persists edits normally when stored quotes are all valid", () => {
    localStorage.setItem("pcqb:quotes:v1", JSON.stringify([Q1, Q2]));
    const { result } = renderHook(() => usePersistence());
    const newQuote = { id: "new", name: "New", rows: [], currency: "CLP" };
    act(() => {
      result.current.setQuotes([newQuote]);
    });
    const stored = JSON.parse(localStorage.getItem("pcqb:quotes:v1"));
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe("new");
  });

  it("initializes currencyDraft from active quote currency", () => {
    localStorage.setItem("pcqb:quotes:v1", JSON.stringify([Q1, Q2]));
    localStorage.setItem("pcqb:activeQuoteId:v1", "q2");
    const { result } = renderHook(() => usePersistence());
    expect(result.current.currencyDraft).toBe("USD");
  });

  it("defaults currencyDraft to CLP when no quotes", () => {
    const { result } = renderHook(() => usePersistence());
    expect(result.current.currencyDraft).toBe("CLP");
  });

  it("updates currencyDraft via setter", () => {
    const { result } = renderHook(() => usePersistence());
    act(() => {
      result.current.setCurrencyDraft("EUR");
    });
    expect(result.current.currencyDraft).toBe("EUR");
  });
});
