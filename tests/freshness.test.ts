import type { ElectionSnapshot, HealthStatus } from "../src/lib/types";
import {
  getElapsedMinutes,
  hydrateHealthFreshness,
  hydrateSnapshotFreshness
} from "../netlify/functions/_shared/freshness";

function createSnapshot(overrides: Partial<ElectionSnapshot> = {}): ElectionSnapshot {
  return {
    generatedAt: "2026-04-15T12:00:00.000Z",
    sourceElectionId: 10,
    sourceLastUpdatedAt: "2026-04-15T11:55:00.000Z",
    national: {} as ElectionSnapshot["national"],
    foreign: {} as ElectionSnapshot["foreign"],
    regions: [],
    projectedNational: {
      totalElectores: 0,
      totalProjectedValidVotes: 0,
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
    lastSyncAt: "2026-04-15T12:00:00.000Z",
    lastSuccessAt: "2026-04-15T12:00:00.000Z",
    staleMinutes: 0,
    lastError: null,
    ...overrides
  };
}

describe("freshness helpers", () => {
  it("rehidrata snapshot.isStale usando generatedAt actual", () => {
    const hydrated = hydrateSnapshotFreshness(
      createSnapshot({
        generatedAt: "2026-04-15T12:00:00.000Z",
        isStale: false
      }),
      new Date("2026-04-15T12:20:00.000Z").getTime()
    );

    expect(hydrated.isStale).toBe(true);
  });

  it("rehidrata health como degraded cuando el ultimo fetch exitoso supera el umbral", () => {
    const hydrated = hydrateHealthFreshness(
      createHealth({
        status: "healthy",
        staleMinutes: 0,
        lastSuccessAt: "2026-04-15T12:00:00.000Z"
      }),
      new Date("2026-04-15T12:20:00.000Z").getTime()
    );

    expect(hydrated.status).toBe("degraded");
    expect(hydrated.staleMinutes).toBe(20);
  });

  it("mantiene degraded si existe un ultimo error aunque el fetch reciente siga fresco", () => {
    const hydrated = hydrateHealthFreshness(
      createHealth({
        status: "healthy",
        lastSuccessAt: "2026-04-15T12:10:00.000Z",
        lastError: "timeout"
      }),
      new Date("2026-04-15T12:20:00.000Z").getTime()
    );

    expect(hydrated.status).toBe("degraded");
    expect(hydrated.staleMinutes).toBe(10);
  });

  it("calcula minutos transcurridos redondeando al minuto mas cercano", () => {
    expect(
      getElapsedMinutes(
        "2026-04-15T12:00:00.000Z",
        new Date("2026-04-15T12:09:31.000Z").getTime()
      )
    ).toBe(10);
  });
});
