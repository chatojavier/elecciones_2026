import {
  DEV_REFRESH_ENDPOINT,
  HEALTH_ENDPOINT,
  SNAPSHOT_ENDPOINT,
  SYNC_ENDPOINT
} from "./constants";
import { normalizeElectionSnapshot } from "./normalizeSnapshot";
import type { ElectionSnapshot, HealthStatus } from "./types";

export interface AppData {
  snapshot: ElectionSnapshot;
  health: HealthStatus;
}

const DEV_SNAPSHOT_ENDPOINT = "/dev-snapshot.json";

function useNetlifyFunctionsInDev() {
  return import.meta.env.VITE_USE_NETLIFY_FUNCTIONS === "true";
}

function getSnapshotCandidates() {
  if (import.meta.env.DEV) {
    if (useNetlifyFunctionsInDev()) {
      return [SNAPSHOT_ENDPOINT];
    }

    return [DEV_SNAPSHOT_ENDPOINT, SNAPSHOT_ENDPOINT];
  }

  return [SNAPSHOT_ENDPOINT];
}

async function parseSnapshotResponse(endpoint: string, response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok) {
    throw new Error(`No se pudo cargar ${endpoint} (${response.status}).`);
  }

  if (!contentType.includes("application/json")) {
    throw new Error(`${endpoint} no respondió JSON.`);
  }

  return normalizeElectionSnapshot((await response.json()) as ElectionSnapshot);
}

async function parseHealthResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok) {
    throw new Error(`No se pudo cargar health (${response.status}).`);
  }

  if (!contentType.includes("application/json")) {
    throw new Error("El endpoint de health no respondió JSON.");
  }

  return (await response.json()) as HealthStatus;
}

function buildFallbackHealth(snapshot: ElectionSnapshot): HealthStatus {
  return {
    status: snapshot.isStale ? "degraded" : "healthy",
    source: "onpe",
    lastSyncAt: snapshot.generatedAt,
    lastSuccessAt: snapshot.generatedAt,
    staleMinutes: null,
    lastError: null
  };
}

function getUsableHealth(health: HealthStatus | null, snapshot: ElectionSnapshot) {
  if (!health?.lastSuccessAt) {
    return buildFallbackHealth(snapshot);
  }

  return health;
}

async function parseSyncResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (response.status === 202 || response.status === 429) {
    if (!contentType.includes("application/json")) {
      return null;
    }

    const payload = (await response.json()) as {
      code?: string;
      retryAfterSeconds?: number;
      health?: HealthStatus;
    };

    if (
      payload.code === "sync_in_progress" ||
      payload.code === "sync_too_recent" ||
      typeof payload.retryAfterSeconds === "number" ||
      payload.health
    ) {
      return null;
    }

    return null;
  }

  if (!response.ok) {
    throw new Error(`No se pudo sincronizar datos (${response.status}).`);
  }

  if (!contentType.includes("application/json")) {
    throw new Error("El endpoint de sincronización no respondió JSON.");
  }

  const payload = (await response.json()) as {
    ok?: boolean;
    error?: string;
    snapshot?: ElectionSnapshot;
    health?: HealthStatus;
  };

  if (!payload.ok) {
    throw new Error(payload.error ?? "La sincronización de datos falló.");
  }

  return payload.snapshot
    ? {
        snapshot: normalizeElectionSnapshot(payload.snapshot),
        health: payload.health ?? null
      }
    : null;
}

function buildRequestUrl(endpoint: string) {
  const url = new URL(endpoint, window.location.origin);
  url.searchParams.set("_ts", String(Date.now()));
  return url.toString();
}

async function fetchSnapshotFromEndpoint(endpoint: string) {
  const response = await fetch(buildRequestUrl(endpoint), {
    cache: "no-store"
  });
  return await parseSnapshotResponse(endpoint, response);
}

async function fetchHealth() {
  const response = await fetch(buildRequestUrl(HEALTH_ENDPOINT), {
    cache: "no-store"
  });

  return await parseHealthResponse(response);
}

export async function fetchSnapshot() {
  const errors: string[] = [];

  for (const endpoint of getSnapshotCandidates()) {
    try {
      return await fetchSnapshotFromEndpoint(endpoint);
    } catch (error) {
      errors.push((error as Error).message);
    }
  }

  throw new Error(errors[0] ?? "No se pudo cargar el snapshot público.");
}

export async function fetchAppData(): Promise<AppData> {
  const snapshotPromise = fetchSnapshot();
  const healthPromise = fetchHealth().catch(() => null);

  const snapshot = await snapshotPromise;
  const health = await healthPromise;

  return {
    snapshot,
    health: getUsableHealth(health, snapshot)
  };
}

export async function refreshSnapshot() {
  const data = await refreshAppData();
  return data.snapshot;
}

export async function refreshAppData(): Promise<AppData> {
  const syncEndpoint =
    import.meta.env.DEV && !useNetlifyFunctionsInDev() ? DEV_REFRESH_ENDPOINT : SYNC_ENDPOINT;
  const syncResponse = await fetch(buildRequestUrl(syncEndpoint), {
    method: "POST",
    cache: "no-store"
  });
  const syncedSnapshot = await parseSyncResponse(syncResponse);

  if (syncedSnapshot) {
    return {
      snapshot: syncedSnapshot.snapshot,
      health: getUsableHealth(syncedSnapshot.health, syncedSnapshot.snapshot)
    };
  }

  return await fetchAppData();
}
