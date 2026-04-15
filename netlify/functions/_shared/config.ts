export const ONPE_BASE_URL =
  process.env.ONPE_BASE_URL ??
  "https://resultadoelectoral.onpe.gob.pe/presentacion-backend";

export const ONPE_ELECTION_ID = Number(process.env.ONPE_ELECTION_ID ?? "10");
export const ONPE_USER_AGENT =
  process.env.ONPE_USER_AGENT ??
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.4 Safari/605.1.15";
export const ONPE_REFERER =
  process.env.ONPE_REFERER ??
  "https://resultadoelectoral.onpe.gob.pe/main/resumen";
export const ONPE_COOKIE = process.env.ONPE_COOKIE ?? "";

export const STORAGE_NAME = "onpe-results";
export const SNAPSHOT_KEY = "snapshot";
export const HEALTH_KEY = "health";
