/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { useFreshnessStatus, type RefreshFeedback } from "../src/hooks/useFreshnessStatus";
import type { ElectionSnapshot, HealthStatus } from "../src/lib/types";

function createSnapshot(overrides: Partial<ElectionSnapshot> = {}) {
  return {
    generatedAt: "2026-04-15T12:05:00.000Z",
    sourceLastUpdatedAt: "2026-04-15T12:00:00.000Z",
    ...overrides
  } as ElectionSnapshot;
}

function createHealth(overrides: Partial<HealthStatus> = {}) {
  return {
    lastSuccessAt: "2026-04-15T12:05:00.000Z",
    ...overrides
  } as HealthStatus;
}

describe("useFreshnessStatus", () => {
  let container: HTMLDivElement;
  let root: Root;
  let result: ReturnType<typeof useFreshnessStatus> | null = null;

  function Harness({
    snapshot,
    health,
    refreshFeedback,
    clockNow
  }: {
    snapshot: ElectionSnapshot | null;
    health: HealthStatus | null;
    refreshFeedback: RefreshFeedback;
    clockNow: number;
  }) {
    result = useFreshnessStatus({ snapshot, health, refreshFeedback, clockNow });
    return null;
  }

  beforeEach(() => {
    (
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT?: boolean;
      }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    result = null;
  });

  it("arma status y payload con las prioridades actuales", async () => {
    await act(async () => {
      root.render(
        <Harness
          snapshot={createSnapshot({
            generatedAt: "2026-04-15T12:40:00.000Z",
            sourceLastUpdatedAt: "2026-04-15T12:00:00.000Z"
          })}
          health={createHealth({ lastSuccessAt: "2026-04-15T12:40:00.000Z" })}
          refreshFeedback={null}
          clockNow={new Date("2026-04-15T12:42:00.000Z").getTime()}
        />
      );
    });

    expect(result?.appFreshnessStatus).toBe("Al día");
    expect(result?.statusNote).toBe("ONPE aún no publica un corte más reciente.");
    expect(result?.trackingPayload).toEqual({
      app_fetch_age_minutes: 2,
      app_freshness_status: "Al día",
      source_age_minutes: 42,
      source_has_new_cut: false,
      snapshot_generated_at: "2026-04-15T12:40:00.000Z"
    });

    await act(async () => {
      root.render(
        <Harness
          snapshot={createSnapshot({
            generatedAt: "2026-04-15T12:00:00.000Z",
            sourceLastUpdatedAt: "2026-04-15T12:40:00.000Z"
          })}
          health={createHealth({ lastSuccessAt: "2026-04-15T12:00:00.000Z" })}
          refreshFeedback={null}
          clockNow={new Date("2026-04-15T12:55:00.000Z").getTime()}
        />
      );
    });

    expect(result?.appFreshnessStatus).toBe("Desactualizado");
    expect(result?.statusNote).toBe("Mostramos el último snapshot disponible.");

    await act(async () => {
      root.render(
        <Harness
          snapshot={createSnapshot()}
          health={createHealth()}
          refreshFeedback={{ kind: "error", message: "No se pudo actualizar. Intenta nuevamente." }}
          clockNow={new Date("2026-04-15T12:06:00.000Z").getTime()}
        />
      );
    });
    expect(result?.statusNote).toBe("No se pudo actualizar. Intenta nuevamente.");

    await act(async () => {
      root.render(
        <Harness
          snapshot={createSnapshot()}
          health={createHealth()}
          refreshFeedback={{ kind: "success", message: "App actualizada correctamente." }}
          clockNow={new Date("2026-04-15T12:06:00.000Z").getTime()}
        />
      );
    });
    expect(result?.statusNote).toBe("App actualizada correctamente.");
  });

  it("omite campos opcionales cuando falta snapshot y health", async () => {
    await act(async () => {
      root.render(
        <Harness
          snapshot={null}
          health={null}
          refreshFeedback={null}
          clockNow={new Date("2026-04-15T12:06:00.000Z").getTime()}
        />
      );
    });

    expect(result?.trackingPayload).toEqual({
      app_fetch_age_minutes: undefined,
      app_freshness_status: "Desactualizado",
      source_age_minutes: undefined,
      source_has_new_cut: true,
      snapshot_generated_at: undefined
    });
  });
});
