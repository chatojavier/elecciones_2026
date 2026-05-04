import { computeIsStale } from "../../../src/lib/domain";
import type { ElectionSnapshot, HealthStatus } from "../../../src/lib/types";

export function getElapsedMinutes(isoDate: string, now = Date.now()) {
  return Math.max(0, Math.round((now - new Date(isoDate).getTime()) / 60000));
}

export function hydrateSnapshotFreshness(snapshot: ElectionSnapshot, now = Date.now()) {
  return {
    ...snapshot,
    isStale: computeIsStale(snapshot.generatedAt, now)
  };
}

export function hydrateHealthFreshness(health: HealthStatus, now = Date.now()): HealthStatus {
  if (!health.lastSuccessAt) {
    return health;
  }

  const staleMinutes = getElapsedMinutes(health.lastSuccessAt, now);
  const isStale = computeIsStale(health.lastSuccessAt, now);

  return {
    ...health,
    status: health.lastError || isStale ? "degraded" : "healthy",
    staleMinutes
  };
}
