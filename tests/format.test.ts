import { describe, expect, it } from "vitest";

import { formatRelativeMinutes, formatTitleCase, getElapsedMinutes } from "../src/lib/format";

describe("formatTitleCase", () => {
  it("convierte nombres completos a title case", () => {
    expect(formatTitleCase("JORGE LUIS PEREZ FLORES")).toBe("Jorge Luis Perez Flores");
  });

  it("mantiene conectores comunes en minúscula", () => {
    expect(formatTitleCase("MARIA DEL CARMEN DE LA CRUZ")).toBe("Maria del Carmen de la Cruz");
  });

  it("respeta apellidos compuestos con guion", () => {
    expect(formatTitleCase("ANA MARIA LOPEZ-ALIAGA")).toBe("Ana Maria Lopez-Aliaga");
  });
});

describe("getElapsedMinutes", () => {
  it("redondea minutos con la misma lógica usada en pantalla", () => {
    expect(getElapsedMinutes("2026-04-15T18:00:00.000Z", Date.parse("2026-04-15T18:15:31.000Z"))).toBe(16);
  });
});

describe("formatRelativeMinutes", () => {
  it("muestra minutos usando un reloj inyectable", () => {
    expect(
      formatRelativeMinutes("2026-04-15T18:00:00.000Z", Date.parse("2026-04-15T18:30:31.000Z"))
    ).toBe("hace 31 minutos");
  });
});
