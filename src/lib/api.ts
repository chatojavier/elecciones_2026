import { DEV_REFRESH_ENDPOINT, SNAPSHOT_ENDPOINT, SYNC_ENDPOINT } from "./constants";
import type { ElectionSnapshot } from "./types";

const DEV_SNAPSHOT_ENDPOINT = "/dev-snapshot.json";

function getSnapshotCandidates() {
  if (import.meta.env.DEV) {
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

  return (await response.json()) as ElectionSnapshot;
}

async function parseSyncResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok) {
    throw new Error(`No se pudo sincronizar datos (${response.status}).`);
  }

  if (!contentType.includes("application/json")) {
    throw new Error("El endpoint de sincronización no respondió JSON.");
  }

  const payload = (await response.json()) as { ok?: boolean; error?: string };

  if (!payload.ok) {
    throw new Error(payload.error ?? "La sincronización de datos falló.");
  }
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

export async function refreshSnapshot() {
  const syncEndpoint = import.meta.env.DEV ? DEV_REFRESH_ENDPOINT : SYNC_ENDPOINT;
  const syncResponse = await fetch(buildRequestUrl(syncEndpoint), {
    method: "POST",
    cache: "no-store"
  });
  await parseSyncResponse(syncResponse);

  return await fetchSnapshotFromEndpoint(import.meta.env.DEV ? DEV_SNAPSHOT_ENDPOINT : SNAPSHOT_ENDPOINT);
}
