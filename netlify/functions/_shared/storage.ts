import { getStore } from "@netlify/blobs";

import {
  FIRST_ROUND_STORAGE,
  STORAGE_NAME,
  type RoundStorageConfig
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

function resolveStorageConfig(config?: RoundStorageConfig) {
  return config ?? FIRST_ROUND_STORAGE;
}

export async function readSnapshot(config?: RoundStorageConfig) {
  const storage = resolveStorageConfig(config);
  const store = getStorageStore();
  const snapshot = (await store.get(storage.snapshotKey, { type: "json" })) as unknown;
  if (snapshot == null) {
    return null;
  }
  try {
    const parsedSnapshot = hydrateSnapshotFreshness(
      normalizeElectionSnapshot(parseElectionSnapshot(snapshot))
    );

    if (parsedSnapshot.round !== storage.round) {
      console.warn(
        `[storage] snapshot round mismatch ignored: expected ${storage.round}, got ${parsedSnapshot.round}`
      );
      return null;
    }

    return parsedSnapshot;
  } catch (error) {
    console.warn(`[storage] invalid snapshot blob ignored: ${(error as Error).message}`);
    return null;
  }
}

export async function writeSnapshot(snapshot: ElectionSnapshot, config?: RoundStorageConfig) {
  const storage = resolveStorageConfig(config);
  const store = getStorageStore();
  await store.setJSON(storage.snapshotKey, snapshot);
}

export async function readHealth(config?: RoundStorageConfig) {
  const storage = resolveStorageConfig(config);
  const store = getStorageStore();
  const health = (await store.get(storage.healthKey, { type: "json" })) as unknown;
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

export async function writeHealth(health: HealthStatus, config?: RoundStorageConfig) {
  const storage = resolveStorageConfig(config);
  const store = getStorageStore();
  await store.setJSON(storage.healthKey, health);
}

export async function readSyncLock(config?: RoundStorageConfig) {
  const storage = resolveStorageConfig(config);
  const store = getStorageStore();
  return (await store.get(storage.syncLockKey, { type: "json" })) as unknown;
}

export async function writeSyncLock(lock: SyncLock, config?: RoundStorageConfig) {
  const storage = resolveStorageConfig(config);
  const store = getStorageStore();
  await store.setJSON(storage.syncLockKey, lock);
}

export async function deleteSyncLock(config?: RoundStorageConfig) {
  const storage = resolveStorageConfig(config);
  const store = getStorageStore();
  await store.delete(storage.syncLockKey);
}
