import { STALE_AFTER_MINUTES } from "./constants";
import { getElapsedMinutes } from "./format";

export type AppFreshnessStatus = "Al día" | "Desactualizado";

export function getAppFetchAgeMinutes(lastSuccessAt: string | null, now = Date.now()) {
  return lastSuccessAt ? getElapsedMinutes(lastSuccessAt, now) : null;
}

export function getSourceAgeMinutes(sourceLastUpdatedAt: string, now = Date.now()) {
  return getElapsedMinutes(sourceLastUpdatedAt, now);
}

export function deriveAppFreshnessStatus(
  lastSuccessAt: string | null,
  now = Date.now()
): AppFreshnessStatus {
  const ageMinutes = getAppFetchAgeMinutes(lastSuccessAt, now);

  if (ageMinutes === null) {
    return "Desactualizado";
  }

  return ageMinutes <= STALE_AFTER_MINUTES ? "Al día" : "Desactualizado";
}

export function getNextAutoRefreshInMinutes(lastSuccessAt: string | null, now = Date.now()) {
  if (!lastSuccessAt) {
    return null;
  }

  const nextReviewAt = new Date(lastSuccessAt).getTime() + STALE_AFTER_MINUTES * 60_000;
  const remainingMs = nextReviewAt - now;

  if (remainingMs <= 0) {
    return 0;
  }

  return Math.ceil(remainingMs / 60_000);
}

export function shouldAutoRefresh(lastSuccessAt: string | null, now = Date.now()) {
  if (!lastSuccessAt) {
    return false;
  }

  return now - new Date(lastSuccessAt).getTime() >= STALE_AFTER_MINUTES * 60_000;
}

export function getSourceHasNewCut(
  currentSourceLastUpdatedAt: string,
  lastSuccessAt: string | null,
  previousSourceLastUpdatedAt: string | null = null
) {
  const currentSourceMs = new Date(currentSourceLastUpdatedAt).getTime();

  if (previousSourceLastUpdatedAt) {
    return currentSourceMs > new Date(previousSourceLastUpdatedAt).getTime();
  }

  if (!lastSuccessAt) {
    return true;
  }

  const freshnessFloorMs = new Date(lastSuccessAt).getTime() - STALE_AFTER_MINUTES * 60_000;
  return currentSourceMs >= freshnessFloorMs;
}
