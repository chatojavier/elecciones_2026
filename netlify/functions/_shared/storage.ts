import { getStore } from "@netlify/blobs";

import {
  HEALTH_KEY,
  SNAPSHOT_KEY,
  STORAGE_NAME
} from "./config";
import { normalizeElectionSnapshot } from "../../../src/lib/normalizeSnapshot";
import type { ElectionSnapshot, HealthStatus } from "../../../src/lib/types";

function getStorageStore() {
  return getStore(STORAGE_NAME);
}

export async function readSnapshot() {
  const store = getStorageStore();
  const snapshot = (await store.get(SNAPSHOT_KEY, { type: "json" })) as ElectionSnapshot | null;
  return snapshot ? normalizeElectionSnapshot(snapshot) : null;
}

export async function writeSnapshot(snapshot: ElectionSnapshot) {
  const store = getStorageStore();
  await store.setJSON(SNAPSHOT_KEY, snapshot);
}

export async function readHealth() {
  const store = getStorageStore();
  return (await store.get(HEALTH_KEY, { type: "json" })) as HealthStatus | null;
}

export async function writeHealth(health: HealthStatus) {
  const store = getStorageStore();
  await store.setJSON(HEALTH_KEY, health);
}
