import { describe, expect, it } from "vitest";
import { extractCpuFamily, inferBrand, inferSocket } from "./catalogHelpers.js";

describe("catalogHelpers", () => {
  it("clasifica familias Intel Core", () => {
    expect(extractCpuFamily({ name: "Intel Core i5-12400F" })).toBe("Core i5");
    expect(extractCpuFamily({ name: "i7-14700K" })).toBe("Core i7");
    expect(extractCpuFamily({ name: "Intel Core Ultra 7" })).toBe("Core Ultra");
  });

  it("clasifica familias AMD Ryzen y Threadripper", () => {
    expect(extractCpuFamily({ name: "AMD Ryzen 7 7800X3D" })).toBe("Ryzen 7");
    expect(extractCpuFamily({ name: "Ryzen 5 5600" })).toBe("Ryzen 5");
    expect(extractCpuFamily({ name: "Threadripper 3990X" })).toBe("Threadripper");
  });

  it("infere marca por nombre si falta brand", () => {
    expect(inferBrand({ name: "Intel Core i5-12400F" })).toBe("Intel");
    expect(inferBrand({ name: "AMD Ryzen 7 7800X3D" })).toBe("AMD");
    expect(inferBrand({ name: "Threadripper Pro" })).toBe("AMD");
  });

  it("infere socket por generación", () => {
    expect(inferSocket({ name: "Intel Core i5-12400F" })).toBe("LGA1700");
    expect(inferSocket({ name: "Intel Core i9-10900K" })).toBe("LGA1200");
    expect(inferSocket({ name: "Intel Core i7-8700K" })).toBe("LGA1151");
    expect(inferSocket({ name: "AMD Ryzen 7 7800X3D" })).toBe("AM5");
    expect(inferSocket({ name: "AMD Ryzen 5 5600" })).toBe("AM4");
  });
});
