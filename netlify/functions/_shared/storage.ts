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
const VALID_SYNC_TRIGGERS: SyncTrigger[] = ["manual", "scheduled", "snapshot_fallback"];
let strongConsistencyAvailableForLocks = true;

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

function isStrongConsistencyUnavailable(error: unknown) {
  return (
    error instanceof Error &&
    error.name === "BlobsConsistencyError" &&
    error.message.includes("uncachedEdgeURL")
  );
}

function getPreferredLockConsistency(): "strong" | "eventual" {
  return strongConsistencyAvailableForLocks ? "strong" : "eventual";
}

function disableStrongConsistencyForLocks() {
  if (strongConsistencyAvailableForLocks) {
    strongConsistencyAvailableForLocks = false;
    console.warn(
      "[storage] strong consistency is unavailable in this environment; falling back to eventual consistency for sync locks."
    );
  }
}

function isValidIsoDate(value: unknown) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function parseSyncLock(value: unknown, blobKey: string): SyncLock | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (
    record.key !== blobKey ||
    typeof record.token !== "string" ||
    !VALID_SYNC_TRIGGERS.includes(record.trigger as SyncTrigger) ||
    !isValidIsoDate(record.startedAt) ||
    !isValidIsoDate(record.expiresAt)
  ) {
    return null;
  }

  return {
    key: record.key as string,
    token: record.token as string,
    trigger: record.trigger as SyncTrigger,
    startedAt: record.startedAt as string,
    expiresAt: record.expiresAt as string
  };
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
  let health: unknown;

  try {
    health = (await store.get(HEALTH_KEY, { type: "json" })) as unknown;
  } catch (error) {
    if (consistency === "strong" && isStrongConsistencyUnavailable(error)) {
      console.warn(
        "[storage] strong consistency is unavailable in this environment; falling back to eventual consistency for health reads."
      );
      return readHealth("eventual");
    }

    throw error;
  }

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
  const preferredConsistency = getPreferredLockConsistency();
  const store = getStorageStore(preferredConsistency);
  let blobs: Array<{ key: string }>;

  try {
    ({ blobs } = await store.list({
      prefix: SYNC_LOCK_PREFIX
    }));
  } catch (error) {
    if (preferredConsistency === "strong" && isStrongConsistencyUnavailable(error)) {
      disableStrongConsistencyForLocks();
      return readSyncLock(now);
    }

    throw error;
  }

  const activeLocks: SyncLock[] = [];

  for (const blob of blobs) {
    let rawLock: unknown;

    try {
      rawLock = await store.get(blob.key, {
        type: "json",
        consistency: preferredConsistency
      });
    } catch (error) {
      if (preferredConsistency === "strong" && isStrongConsistencyUnavailable(error)) {
        disableStrongConsistencyForLocks();
        return readSyncLock(now);
      }

      throw error;
    }

    const lock = parseSyncLock(rawLock, blob.key);

    if (!lock) {
      console.warn(`[storage] lock inválido ${blob.key}; eliminando blob.`);
      await store.delete(blob.key);
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
  const store = getStorageStore(getPreferredLockConsistency());
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
  const store = getStorageStore(getPreferredLockConsistency());
  const activeLock = await readSyncLock();

  if (activeLock?.token === token) {
    await store.delete(activeLock.key);
  }
}

function logInvalidBlob(key: string, error: unknown) {
  const message = error instanceof Error ? error.message : "error desconocido";
  console.warn(`[storage] blob inválido ${key}: ${message}`);
}
