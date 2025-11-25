export const extractCpuFamily = (cpu) => {
  const name = (cpu?.name || "").toLowerCase();
  if (name.includes("core ultra")) return "Core Ultra";
  const intel =
    name.match(/core\s+i(\d)/) ||
    name.match(/\bi(\d)[- ]\d{4,5}/) ||
    name.match(/\bi(\d)-\d{3,4}/);
  if (intel) return `Core i${intel[1]}`;
  if (name.includes("pentium")) return "Pentium";
  if (name.includes("celeron")) return "Celeron";
  const ryzen = name.match(/ryzen\s+(\d)/);
  if (ryzen) return `Ryzen ${ryzen[1]}`;
  if (name.includes("threadripper")) return "Threadripper";
  return "Otros";
};

export const inferBrand = (cpu) => {
  const brand = (cpu?.brand || "").trim();
  if (brand) return brand;
  const name = (cpu?.name || "").toLowerCase();
  if (name.includes("intel") || name.includes("core") || name.includes("pentium") || name.includes("celeron")) return "Intel";
  if (name.includes("ryzen") || name.includes("threadripper") || name.includes("amd")) return "AMD";
  return "Desconocido";
};

export const inferSocket = (cpu) => {
  const name = (cpu?.name || "").toLowerCase();
  const intelGen = name.match(/i\d[- ](\d{4,5})/);
  if (intelGen) {
    const gen = intelGen[1];
    if (gen.startsWith("14") || gen.startsWith("13") || gen.startsWith("12")) return "LGA1700";
    if (gen.startsWith("11") || gen.startsWith("10")) return "LGA1200";
    if (gen.startsWith("9") || gen.startsWith("8")) return "LGA1151";
  }
  const ryzenGen = name.match(/ryzen\s+(\d{4,5})/);
  if (ryzenGen) {
    const genNum = parseInt(ryzenGen[1], 10);
    if (genNum >= 7000) return "AM5";
    if (genNum >= 2000) return "AM4";
  }
  const ryzenAlt = name.match(/ryzen\s+\d\s+(\d{4,5})/);
  if (ryzenAlt) {
    const genNum = parseInt(ryzenAlt[1], 10);
    if (genNum >= 7000) return "AM5";
    if (genNum >= 2000) return "AM4";
  }
  return cpu?.socket || "";
};

export const inferMemoryTypeBySocket = (socket = "") => {
  const s = socket.toUpperCase();
  if (!s) return "";
  if (s === "AM5") return "DDR5";
  if (s === "AM4") return "DDR4";
  if (s === "LGA1700") return "DDR5"; // la mayoría son DDR5; DDR4 existe pero preferimos restringir
  if (s === "LGA1200" || s === "LGA1151") return "DDR4";
  return "";
};
