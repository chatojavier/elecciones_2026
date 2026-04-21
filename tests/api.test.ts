/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { refreshSnapshot } from "../src/lib/api";
import type { ElectionSnapshot } from "../src/lib/types";

function createSnapshot(overrides: Partial<ElectionSnapshot> = {}): ElectionSnapshot {
  const baseScope = {
    scopeId: "1",
    kind: "national" as const,
    label: "PERU",
    electores: 1000,
    padronShare: 100,
    actasContabilizadasPct: 80,
    contabilizadas: 80,
    totalActas: 100,
    participacionCiudadanaPct: 70,
    enviadasJee: 0,
    pendientesJee: 0,
    totalVotosEmitidos: 850,
    totalVotosValidos: 800,
    sourceUpdatedAt: "2026-04-21T12:00:00.000Z",
    candidates: [],
    featuredCandidates: [],
    otros: {
      code: "otros" as const,
      label: "Otros",
      votesValid: 0,
      pctValid: 0,
      pctEmitted: 0
    },
    projectedVotes: {}
  };

  return {
    generatedAt: "2026-04-21T12:01:00.000Z",
    sourceElectionId: 10,
    sourceLastUpdatedAt: "2026-04-21T12:00:00.000Z",
    national: baseScope,
    foreign: {
      ...baseScope,
      scopeId: "2",
      kind: "foreign_total",
      continents: []
    },
    regions: [],
    projectedNational: {
      totalElectores: 1000,
      totalProjectedValidVotes: 800,
      projectedVotes: {},
      projectedPercentages: {}
    },
    featuredCandidateCodes: [],
    isStale: false,
    ...overrides
  };
}

describe("refreshSnapshot", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("usa el snapshot devuelto por el sync sin hacer un segundo fetch", async () => {
    const snapshot = createSnapshot({
      generatedAt: "2026-04-21T12:05:00.000Z"
    });
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, snapshot }), {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      })
    );

    const result = await refreshSnapshot();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual(snapshot);
  });
});
