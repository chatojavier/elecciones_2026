import type { ElectionSnapshot, HealthStatus } from "../../../src/lib/types";
import {
  SYNC_LOCK_TTL_SECONDS,
  SYNC_MANUAL_COOLDOWN_SECONDS
} from "./config";
import { runSync } from "./snapshot";
import {
  acquireSyncLock,
  readHealth,
  readSyncLock,
  releaseSyncLock,
  type SyncTrigger
} from "./storage";

export type SyncFlowResult =
  | {
      state: "synced";
      statusCode: 200;
      snapshot: ElectionSnapshot;
      health: HealthStatus;
    }
  | {
      state: "in_progress";
      statusCode: 202;
    }
  | {
      state: "recent";
      statusCode: 429;
      retryAfterSeconds: number;
    };

function getElapsedSeconds(isoDate: string, now = Date.now()) {
  return Math.max(0, Math.floor((now - new Date(isoDate).getTime()) / 1000));
}

export async function runSyncFlow(
  trigger: SyncTrigger,
  now = Date.now()
): Promise<SyncFlowResult> {
  const activeLock = await readSyncLock(now);

  if (activeLock) {
    return {
      state: "in_progress",
      statusCode: 202
    };
  }

  if (trigger === "manual") {
    const currentHealth = await readHealth();

    if (currentHealth?.lastSuccessAt) {
      const elapsedSeconds = getElapsedSeconds(currentHealth.lastSuccessAt, now);

      if (elapsedSeconds < SYNC_MANUAL_COOLDOWN_SECONDS) {
        return {
          state: "recent",
          statusCode: 429,
          retryAfterSeconds: SYNC_MANUAL_COOLDOWN_SECONDS - elapsedSeconds
        };
      }
    }
  }

  const lock = await acquireSyncLock(trigger, SYNC_LOCK_TTL_SECONDS, now);

  if (!lock) {
    return {
      state: "in_progress",
      statusCode: 202
    };
  }

  try {
    const { snapshot, health } = await runSync();

    return {
      state: "synced",
      statusCode: 200,
      snapshot,
      health
    };
  } finally {
    await releaseSyncLock(lock.token);
  }
}
