/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchAppData, refreshAppData } from "../src/lib/api";
import type { ElectionSnapshot, HealthStatus } from "../src/lib/types";

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

function createHealth(overrides: Partial<HealthStatus> = {}): HealthStatus {
  return {
    status: "healthy",
    source: "onpe",
    lastSyncAt: "2026-04-21T12:01:00.000Z",
    lastSuccessAt: "2026-04-21T12:01:00.000Z",
    staleMinutes: 0,
    lastError: null,
    ...overrides
  };
}

describe("api trust data", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("combina snapshot y health en la carga inicial", async () => {
    const snapshot = createSnapshot();
    const health = createHealth({
      lastSuccessAt: snapshot.generatedAt
    });
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify(snapshot), {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(health), {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        })
      );

    const result = await fetchAppData();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      snapshot,
      health
    });
  });

  it("usa fallback derivado del snapshot cuando /health responde sin lastSuccessAt", async () => {
    const snapshot = createSnapshot({
      generatedAt: "2026-04-21T12:05:00.000Z"
    });
    const health = createHealth({
      status: "unknown",
      lastSyncAt: null,
      lastSuccessAt: null,
      staleMinutes: null
    });
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify(snapshot), {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(health), {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        })
      );

    const result = await fetchAppData();

    expect(result).toEqual({
      snapshot,
      health: {
        status: "healthy",
        source: "onpe",
        lastSyncAt: snapshot.generatedAt,
        lastSuccessAt: snapshot.generatedAt,
        staleMinutes: null,
        lastError: null
      }
    });
  });

  it("usa snapshot y health devueltos por sync sin hacer fetch redundante", async () => {
    const snapshot = createSnapshot({
      generatedAt: "2026-04-21T12:05:00.000Z"
    });
    const health = createHealth({
      lastSyncAt: snapshot.generatedAt,
      lastSuccessAt: snapshot.generatedAt
    });
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, state: "synced", snapshot, health }), {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      })
    );

    const result = await refreshAppData();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      snapshot,
      health,
      refreshState: "synced"
    });
  });

  it("acepta respuestas 200 legacy del refresh sin state", async () => {
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

    const result = await refreshAppData();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      snapshot,
      health: {
        status: "healthy",
        source: "onpe",
        lastSyncAt: snapshot.generatedAt,
        lastSuccessAt: snapshot.generatedAt,
        staleMinutes: null,
        lastError: null
      },
      refreshState: "synced"
    });
  });

  it("reusa el snapshot publico cuando el sync ya esta en curso", async () => {
    const snapshot = createSnapshot({
      generatedAt: "2026-04-21T12:05:00.000Z"
    });
    const health = createHealth({
      lastSyncAt: snapshot.generatedAt,
      lastSuccessAt: snapshot.generatedAt
    });
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, state: "in_progress" }), {
          status: 202,
          headers: {
            "Content-Type": "application/json"
          }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(snapshot), {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(health), {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        })
      );

    const result = await refreshAppData();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result).toEqual({
      snapshot,
      health,
      refreshState: "in_progress"
    });
  });

  it("reusa el snapshot publico cuando el sync manual fue reciente", async () => {
    const snapshot = createSnapshot({
      generatedAt: "2026-04-21T12:05:00.000Z"
    });
    const health = createHealth({
      lastSyncAt: snapshot.generatedAt,
      lastSuccessAt: snapshot.generatedAt
    });
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, state: "recent" }), {
          status: 429,
          headers: {
            "Content-Type": "application/json"
          }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(snapshot), {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(health), {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        })
      );

    const result = await refreshAppData();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result).toEqual({
      snapshot,
      health,
      refreshState: "recent"
    });
  });
});
