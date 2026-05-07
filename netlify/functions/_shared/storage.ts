import { getStore } from "@netlify/blobs";

import {
  HEALTH_KEY,
  SNAPSHOT_KEY,
  SYNC_LOCK_KEY,
  STORAGE_NAME
} from "./config";
import {
  parseElectionSnapshot,
  parseHealthStatus
} from "../../../src/lib/contracts";
import {
  hydrateHealthFreshness,
  hydrateSnapshotFreshness
} from "./freshness";
import { normalizeElectionSnapshot } from "../../../src/lib/normalizeSnapshot";
import type { ElectionSnapshot, HealthStatus } from "../../../src/lib/types";

export interface SyncLock {
  id: string;
  kind: "manual" | "scheduled";
  createdAt: string;
  expiresAt: string;
}

function getStorageStore() {
  return getStore(STORAGE_NAME);
}

export async function readSnapshot() {
  const store = getStorageStore();
  const snapshot = (await store.get(SNAPSHOT_KEY, { type: "json" })) as unknown;
  if (snapshot == null) {
    return null;
  }
  try {
    return hydrateSnapshotFreshness(normalizeElectionSnapshot(parseElectionSnapshot(snapshot)));
  } catch (error) {
    console.warn(`[storage] invalid snapshot blob ignored: ${(error as Error).message}`);
    return null;
  }
}

export async function writeSnapshot(snapshot: ElectionSnapshot) {
  const store = getStorageStore();
  await store.setJSON(SNAPSHOT_KEY, snapshot);
}

export async function readHealth() {
  const store = getStorageStore();
  const health = (await store.get(HEALTH_KEY, { type: "json" })) as unknown;
  if (health == null) {
    return null;
  }
  try {
    return hydrateHealthFreshness(parseHealthStatus(health));
  } catch (error) {
    console.warn(`[storage] invalid health blob ignored: ${(error as Error).message}`);
    return null;
  }
}

export async function writeHealth(health: HealthStatus) {
  const store = getStorageStore();
  await store.setJSON(HEALTH_KEY, health);
}

export async function readSyncLock() {
  const store = getStorageStore();
  return (await store.get(SYNC_LOCK_KEY, { type: "json" })) as unknown;
}

export async function writeSyncLock(lock: SyncLock) {
  const store = getStorageStore();
  await store.setJSON(SYNC_LOCK_KEY, lock);
}

export async function deleteSyncLock() {
  const store = getStorageStore();
  await store.delete(SYNC_LOCK_KEY);
}
