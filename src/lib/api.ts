import {
  DEV_REFRESH_ENDPOINT,
  HEALTH_ENDPOINT,
  SNAPSHOT_ENDPOINT,
  SYNC_ENDPOINT
} from "./constants";
import { parseElectionSnapshot, parseHealthStatus } from "./contracts";
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

  return normalizeElectionSnapshot(parseElectionSnapshot(await response.json()));
}

async function parseHealthResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok) {
    throw new Error(`No se pudo cargar health (${response.status}).`);
  }

  if (!contentType.includes("application/json")) {
    throw new Error("El endpoint de health no respondió JSON.");
  }

  return parseHealthStatus(await response.json());
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function parseSyncResponse(response: Response) {
  if (response.status === 202 || response.status === 429) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`No se pudo sincronizar datos (${response.status}).`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error("El endpoint de sincronización no respondió JSON.");
  }

  const payload = await response.json();
  if (!isRecord(payload)) {
    throw new Error("Respuesta de sincronización inválida.");
  }

  if (!payload.ok) {
    throw new Error(
      typeof payload.error === "string" ? payload.error : "La sincronización de datos falló."
    );
  }

  if (payload.snapshot == null) {
    return null;
  }

  const snapshot = normalizeElectionSnapshot(parseElectionSnapshot(payload.snapshot));
  let health: HealthStatus | null = null;
  if (payload.health != null) {
    try {
      health = parseHealthStatus(payload.health);
    } catch {
      health = null;
    }
  }

  return { snapshot, health };
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
  return parseSnapshotResponse(endpoint, response);
}

async function fetchHealth() {
  const response = await fetch(buildRequestUrl(HEALTH_ENDPOINT), {
    cache: "no-store"
  });

  return parseHealthResponse(response);
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

  return fetchAppData();
}
