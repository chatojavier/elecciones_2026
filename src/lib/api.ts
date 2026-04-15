import { SNAPSHOT_ENDPOINT } from "./constants";
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

function buildRequestUrl(endpoint: string) {
  const url = new URL(endpoint, window.location.origin);
  url.searchParams.set("_ts", String(Date.now()));
  return url.toString();
}

export async function fetchSnapshot() {
  const errors: string[] = [];

  for (const endpoint of getSnapshotCandidates()) {
    try {
      const response = await fetch(buildRequestUrl(endpoint), {
        cache: "no-store"
      });
      return await parseSnapshotResponse(endpoint, response);
    } catch (error) {
      errors.push((error as Error).message);
    }
  }

  throw new Error(errors[0] ?? "No se pudo cargar el snapshot público.");
}
