import type { ElectionRound } from "../../../src/lib/types";

export const ONPE_BASE_URL =
  process.env.ONPE_BASE_URL ??
  "https://resultadoelectoral.onpe.gob.pe/presentacion-backend";
export const ONPE_REFERER =
  process.env.ONPE_REFERER ??
  "https://resultadoelectoral.onpe.gob.pe/main/resumen";
export const ONPE_ELECTION_ID = Number(process.env.ONPE_ELECTION_ID ?? "10");

export const ONPE_SECOND_ROUND_BASE_URL =
  process.env.ONPE_SECOND_ROUND_BASE_URL ??
  "https://resultadosegundavuelta.onpe.gob.pe/presentacion-backend";
export const ONPE_SECOND_ROUND_REFERER =
  process.env.ONPE_SECOND_ROUND_REFERER ??
  "https://resultadosegundavuelta.onpe.gob.pe/main/resumen";
export const ONPE_SECOND_ROUND_ELECTION_ID = Number(
  process.env.ONPE_SECOND_ROUND_ELECTION_ID ?? "10"
);

export const ONPE_USER_AGENT =
  process.env.ONPE_USER_AGENT ??
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.4 Safari/605.1.15";
export const ONPE_ACCEPT_LANGUAGE =
  process.env.ONPE_ACCEPT_LANGUAGE ?? "en-GB,en-US;q=0.9,en;q=0.8";
export const ONPE_COOKIE = process.env.ONPE_COOKIE ?? "";

export const STORAGE_NAME = "onpe-results";
export const SNAPSHOT_KEY = "snapshot";
export const HEALTH_KEY = "health";
export const SYNC_LOCK_KEY = "sync-lock";
export const SECOND_ROUND_SNAPSHOT_KEY = "snapshot-second-round";
export const SECOND_ROUND_HEALTH_KEY = "health-second-round";
export const SECOND_ROUND_SYNC_LOCK_KEY = "sync-lock-second-round";

function parseEnvMs(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseEnvPositiveInt(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const SYNC_LOCK_TTL_MS = parseEnvMs(process.env.SYNC_LOCK_TTL_MS, 10 * 60 * 1000);
export const MANUAL_SYNC_MIN_INTERVAL_MS = parseEnvMs(
  process.env.MANUAL_SYNC_MIN_INTERVAL_MS,
  5 * 60 * 1000
);
export const ONPE_REQUEST_CONCURRENCY = parseEnvPositiveInt(
  process.env.ONPE_REQUEST_CONCURRENCY,
  16
);
export const ONPE_REQUEST_TIMEOUT_MS = parseEnvMs(process.env.ONPE_REQUEST_TIMEOUT_MS, 10_000);
export const SYNC_MANUAL_SECRET = process.env.SYNC_MANUAL_SECRET ?? "";

export interface OnpeSourceConfig {
  round: ElectionRound;
  baseUrl: string;
  referer: string;
  electionId: number;
}

export interface RoundStorageConfig {
  round: ElectionRound;
  snapshotKey: string;
  healthKey: string;
  syncLockKey: string;
}

export const FIRST_ROUND_ONPE_SOURCE: OnpeSourceConfig = {
  round: "first",
  baseUrl: ONPE_BASE_URL,
  referer: ONPE_REFERER,
  electionId: ONPE_ELECTION_ID
};

export const SECOND_ROUND_ONPE_SOURCE: OnpeSourceConfig = {
  round: "second",
  baseUrl: ONPE_SECOND_ROUND_BASE_URL,
  referer: ONPE_SECOND_ROUND_REFERER,
  electionId: ONPE_SECOND_ROUND_ELECTION_ID
};

export const FIRST_ROUND_STORAGE: RoundStorageConfig = {
  round: "first",
  snapshotKey: SNAPSHOT_KEY,
  healthKey: HEALTH_KEY,
  syncLockKey: SYNC_LOCK_KEY
};

export const SECOND_ROUND_STORAGE: RoundStorageConfig = {
  round: "second",
  snapshotKey: SECOND_ROUND_SNAPSHOT_KEY,
  healthKey: SECOND_ROUND_HEALTH_KEY,
  syncLockKey: SECOND_ROUND_SYNC_LOCK_KEY
};
