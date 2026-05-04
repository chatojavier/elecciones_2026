import type { HandlerEvent } from "@netlify/functions";

import type { HealthStatus } from "../../../src/lib/types";
import { MANUAL_SYNC_MIN_INTERVAL_MS, SYNC_MANUAL_SECRET } from "./config";
import type { SyncLock } from "./storage";

export type SyncInvocationKind = "manual" | "scheduled";

export interface SyncLockState {
  state: "active" | "expired" | "invalid" | "none";
  lock: SyncLock | null;
}

function asRecord(value: unknown) {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function parseBodyRecord(body: string | null) {
  if (!body) {
    return null;
  }

  try {
    return asRecord(JSON.parse(body));
  } catch {
    return null;
  }
}

export function getSyncInvocationKind(event: HandlerEvent): SyncInvocationKind {
  const payload = parseBodyRecord(event.body ?? null);
  return typeof payload?.next_run === "string" ? "scheduled" : "manual";
}

export function isManualMethodAllowed(event: HandlerEvent) {
  return event.httpMethod === "POST";
}

export function isManualSecretValid(event: HandlerEvent) {
  if (!SYNC_MANUAL_SECRET) {
    return true;
  }

  const authorization =
    event.headers.authorization ??
    event.headers.Authorization ??
    event.multiValueHeaders?.authorization?.[0] ??
    event.multiValueHeaders?.Authorization?.[0];
  const xSecret =
    event.headers["x-sync-secret"] ??
    event.headers["X-Sync-Secret"] ??
    event.multiValueHeaders?.["x-sync-secret"]?.[0] ??
    event.multiValueHeaders?.["X-Sync-Secret"]?.[0];

  return authorization === `Bearer ${SYNC_MANUAL_SECRET}` || xSecret === SYNC_MANUAL_SECRET;
}

export function isRecentManualSync(
  health: HealthStatus | null,
  nowMs: number = Date.now(),
  minIntervalMs: number = MANUAL_SYNC_MIN_INTERVAL_MS
) {
  if (!health?.lastSuccessAt) {
    return false;
  }

  const lastSuccessMs = Date.parse(health.lastSuccessAt);
  if (!Number.isFinite(lastSuccessMs)) {
    return false;
  }

  return nowMs - lastSuccessMs < minIntervalMs;
}

function isSyncLock(raw: unknown): raw is SyncLock {
  const lock = asRecord(raw);
  return (
    typeof lock?.id === "string" &&
    (lock.kind === "manual" || lock.kind === "scheduled") &&
    typeof lock.createdAt === "string" &&
    typeof lock.expiresAt === "string"
  );
}

export function getSyncLockState(rawLock: unknown, nowMs: number = Date.now()): SyncLockState {
  if (!rawLock) {
    return { state: "none", lock: null };
  }

  if (!isSyncLock(rawLock)) {
    return { state: "invalid", lock: null };
  }

  const expiresMs = Date.parse(rawLock.expiresAt);
  if (!Number.isFinite(expiresMs)) {
    return { state: "invalid", lock: rawLock };
  }

  if (expiresMs <= nowMs) {
    return { state: "expired", lock: rawLock };
  }

  return { state: "active", lock: rawLock };
}
