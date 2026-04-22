import { describe, expect, it } from "vitest";

import {
  deriveAppFreshnessStatus,
  getNextAutoRefreshInMinutes,
  getSourceHasNewCut,
  shouldAutoRefresh
} from "../src/lib/trust";

describe("trust helpers", () => {
  it("mantiene la app al dia cuando el ultimo fetch exitoso sigue fresco", () => {
    expect(
      deriveAppFreshnessStatus(
        "2026-04-15T12:40:00.000Z",
        new Date("2026-04-15T12:42:00.000Z").getTime()
      )
    ).toBe("Al día");
  });

  it("marca desactualizado cuando el ultimo fetch supera los 15 minutos", () => {
    expect(
      deriveAppFreshnessStatus(
        "2026-04-15T12:00:00.000Z",
        new Date("2026-04-15T12:16:00.000Z").getTime()
      )
    ).toBe("Desactualizado");
  });

  it("calcula el countdown de la proxima revision automatica", () => {
    expect(
      getNextAutoRefreshInMinutes(
        "2026-04-15T12:00:00.000Z",
        new Date("2026-04-15T12:07:01.000Z").getTime()
      )
    ).toBe(8);
  });

  it("detecta ausencia de nuevo corte en la heuristica inicial", () => {
    expect(
      getSourceHasNewCut(
        "2026-04-15T12:00:00.000Z",
        "2026-04-15T12:40:00.000Z"
      )
    ).toBe(false);
  });

  it("detecta un nuevo corte cuando la fuente avanza entre refreshes", () => {
    expect(
      getSourceHasNewCut(
        "2026-04-15T12:45:00.000Z",
        "2026-04-15T12:46:00.000Z",
        "2026-04-15T12:00:00.000Z"
      )
    ).toBe(true);
  });

  it("habilita auto-refresh solo cuando se cumple la ventana operativa", () => {
    expect(
      shouldAutoRefresh(
        "2026-04-15T12:00:00.000Z",
        new Date("2026-04-15T12:14:59.000Z").getTime()
      )
    ).toBe(false);
    expect(
      shouldAutoRefresh(
        "2026-04-15T12:00:00.000Z",
        new Date("2026-04-15T12:15:00.000Z").getTime()
      )
    ).toBe(true);
  });
});
