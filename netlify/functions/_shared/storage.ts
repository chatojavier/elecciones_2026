import { getStore } from "@netlify/blobs";

import {
  HEALTH_KEY,
  SNAPSHOT_KEY,
  STORAGE_NAME
} from "./config";
import type { ElectionSnapshot, HealthStatus } from "../../../src/lib/types";

const store = getStore(STORAGE_NAME);

export async function readSnapshot() {
  return (await store.get(SNAPSHOT_KEY, { type: "json" })) as ElectionSnapshot | null;
}

export async function writeSnapshot(snapshot: ElectionSnapshot) {
  await store.setJSON(SNAPSHOT_KEY, snapshot);
}

export async function readHealth() {
  return (await store.get(HEALTH_KEY, { type: "json" })) as HealthStatus | null;
}

export async function writeHealth(health: HealthStatus) {
  await store.setJSON(HEALTH_KEY, health);
}
