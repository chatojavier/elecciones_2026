import { randomUUID } from "node:crypto";

import { getStore } from "@netlify/blobs";

import {
  HEALTH_KEY,
  SNAPSHOT_KEY,
  STORAGE_NAME
} from "./config";
import {
  hydrateHealthFreshness,
  hydrateSnapshotFreshness
} from "./freshness";
import {
  parseElectionSnapshot,
  parseHealthStatus
} from "../../../src/lib/contracts";
import type { ElectionSnapshot, HealthStatus } from "../../../src/lib/types";

export type SyncTrigger = "manual" | "scheduled" | "snapshot_fallback";

export interface SyncLock {
  key: string;
  token: string;
  trigger: SyncTrigger;
  startedAt: string;
  expiresAt: string;
}

const SYNC_LOCK_PREFIX = "sync-locks/";

function getStorageStore(consistency?: "eventual" | "strong") {
  return getStore({
    name: STORAGE_NAME,
    consistency
  });
}

function buildSyncLockKey(now: number, token: string) {
  return `${SYNC_LOCK_PREFIX}${String(now).padStart(16, "0")}-${token}`;
}

function getSyncLockSortValue(key: string) {
  return key.slice(SYNC_LOCK_PREFIX.length);
}

export async function readSnapshot() {
  const store = getStorageStore();
  const snapshot = (await store.get(SNAPSHOT_KEY, { type: "json" })) as unknown;

  if (snapshot == null) {
    return null;
  }

  try {
    return hydrateSnapshotFreshness(
      parseElectionSnapshot(snapshot, `blob:${SNAPSHOT_KEY}`, "$")
    );
  } catch (error) {
    logInvalidBlob(SNAPSHOT_KEY, error);
    return null;
  }
}

export async function writeSnapshot(snapshot: ElectionSnapshot) {
  const store = getStorageStore();
  await store.setJSON(SNAPSHOT_KEY, snapshot);
}

export async function readHealth(consistency?: "eventual" | "strong") {
  const store = getStorageStore(consistency);
  const health = (await store.get(HEALTH_KEY, { type: "json" })) as unknown;

  if (health == null) {
    return null;
  }

  try {
    return hydrateHealthFreshness(parseHealthStatus(health, `blob:${HEALTH_KEY}`, "$"));
  } catch (error) {
    logInvalidBlob(HEALTH_KEY, error);
    return null;
  }
}

export async function writeHealth(health: HealthStatus) {
  const store = getStorageStore();
  await store.setJSON(HEALTH_KEY, health);
}

export async function readSyncLock(now = Date.now()) {
  const store = getStorageStore("strong");
  const { blobs } = await store.list({
    prefix: SYNC_LOCK_PREFIX
  });

  const activeLocks: SyncLock[] = [];

  for (const blob of blobs) {
    const lock = (await store.get(blob.key, {
      type: "json",
      consistency: "strong"
    })) as SyncLock | null;

    if (!lock) {
      continue;
    }

    if (new Date(lock.expiresAt).getTime() <= now) {
      await store.delete(blob.key);
      continue;
    }

    activeLocks.push(lock);
  }

  activeLocks.sort((left, right) => getSyncLockSortValue(left.key).localeCompare(getSyncLockSortValue(right.key)));

  return activeLocks[0] ?? null;
}

export async function acquireSyncLock(trigger: SyncTrigger, ttlSeconds: number, now = Date.now()) {
  const store = getStorageStore("strong");
  const startedAt = new Date(now).toISOString();
  const expiresAt = new Date(now + ttlSeconds * 1000).toISOString();
  const token = randomUUID();
  const candidateLock: SyncLock = {
    key: buildSyncLockKey(now, token),
    token,
    trigger,
    startedAt,
    expiresAt
  };

  await store.setJSON(candidateLock.key, candidateLock);

  const activeLock = await readSyncLock(now);

  if (activeLock?.key === candidateLock.key) {
    return candidateLock;
  }

  await store.delete(candidateLock.key);

  return null;
}

export async function releaseSyncLock(token: string) {
  const store = getStorageStore("strong");
  const activeLock = await readSyncLock();

  if (activeLock?.token === token) {
    await store.delete(activeLock.key);
  }
}

function logInvalidBlob(key: string, error: unknown) {
  const message = error instanceof Error ? error.message : "error desconocido";
  console.warn(`[storage] blob inválido ${key}: ${message}`);
}
