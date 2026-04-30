import { randomUUID } from "node:crypto";

import { getStore } from "@netlify/blobs";

import {
  HEALTH_KEY,
  SNAPSHOT_KEY,
  STORAGE_NAME,
  SYNC_LOCK_KEY
} from "./config";
import {
  hydrateHealthFreshness,
  hydrateSnapshotFreshness
} from "./freshness";
import { normalizeElectionSnapshot } from "../../../src/lib/normalizeSnapshot";
import type { ElectionSnapshot, HealthStatus } from "../../../src/lib/types";

export type SyncTrigger = "manual" | "scheduled" | "snapshot_fallback";

export interface SyncLock {
  token: string;
  trigger: SyncTrigger;
  startedAt: string;
  expiresAt: string;
}

function getStorageStore() {
  return getStore(STORAGE_NAME);
}

export async function readSnapshot() {
  const store = getStorageStore();
  const snapshot = (await store.get(SNAPSHOT_KEY, { type: "json" })) as ElectionSnapshot | null;
  return snapshot ? hydrateSnapshotFreshness(normalizeElectionSnapshot(snapshot)) : null;
}

export async function writeSnapshot(snapshot: ElectionSnapshot) {
  const store = getStorageStore();
  await store.setJSON(SNAPSHOT_KEY, snapshot);
}

export async function readHealth() {
  const store = getStorageStore();
  const health = (await store.get(HEALTH_KEY, { type: "json" })) as HealthStatus | null;
  return health ? hydrateHealthFreshness(health) : null;
}

export async function writeHealth(health: HealthStatus) {
  const store = getStorageStore();
  await store.setJSON(HEALTH_KEY, health);
}

export async function readSyncLock(now = Date.now()) {
  const store = getStorageStore();
  const lock = (await store.get(SYNC_LOCK_KEY, { type: "json" })) as SyncLock | null;

  if (!lock) {
    return null;
  }

  if (new Date(lock.expiresAt).getTime() <= now) {
    await store.delete(SYNC_LOCK_KEY);
    return null;
  }

  return lock;
}

export async function acquireSyncLock(trigger: SyncTrigger, ttlSeconds: number, now = Date.now()) {
  const store = getStorageStore();
  const activeLock = await readSyncLock(now);

  if (activeLock) {
    return null;
  }

  const startedAt = new Date(now).toISOString();
  const expiresAt = new Date(now + ttlSeconds * 1000).toISOString();
  const candidateLock: SyncLock = {
    token: randomUUID(),
    trigger,
    startedAt,
    expiresAt
  };

  await store.setJSON(SYNC_LOCK_KEY, candidateLock);

  const persistedLock = (await store.get(SYNC_LOCK_KEY, { type: "json" })) as SyncLock | null;

  return persistedLock?.token === candidateLock.token ? candidateLock : null;
}

export async function releaseSyncLock(token: string) {
  const store = getStorageStore();
  const lock = (await store.get(SYNC_LOCK_KEY, { type: "json" })) as SyncLock | null;

  if (lock?.token === token) {
    await store.delete(SYNC_LOCK_KEY);
  }
}
