export const FEATURED_CANDIDATE_LIMIT = 5;
export const OTHER_CANDIDATE_COLOR = "#475569";
export const UNKNOWN_CANDIDATE_COLOR = "#94a3b8";

// Derived from the official ONPE party logos served at
// https://resultadoelectoral.onpe.gob.pe/assets/img-reales/partidos/{codigo}.jpg.
const PARTY_COLORS_BY_CODE: Record<string, string> = {
  "1": "#2563eb",
  "2": "#dc2626",
  "3": "#16a34a",
  "4": "#ec4899",
  "5": "#166534",
  "7": "#2563eb",
  "8": "#f97316",
  "9": "#1d4ed8",
  "10": "#16a34a",
  "11": "#ca8a04",
  "12": "#dc2626",
  "14": "#15803d",
  "15": "#ca8a04",
  "16": "#ea580c",
  "17": "#16a34a",
  "18": "#16a34a",
  "19": "#dc2626",
  "20": "#dc2626",
  "21": "#374151",
  "22": "#7c3aed",
  "23": "#ca8a04",
  "24": "#1f2937",
  "25": "#ef4444",
  "26": "#64748b",
  "27": "#dc2626",
  "28": "#2563eb",
  "29": "#dc2626",
  "30": "#dc2626",
  "31": "#dc2626",
  "32": "#1d4ed8",
  "33": "#1d4ed8",
  "34": "#16a34a",
  "35": "#0ea5e9",
  "36": "#dc2626",
  "37": "#dc2626",
  "38": "#2563eb"
};

export function getCandidateColor(code: string) {
  if (code === "otros") {
    return OTHER_CANDIDATE_COLOR;
  }

  return PARTY_COLORS_BY_CODE[code] ?? UNKNOWN_CANDIDATE_COLOR;
}

export const SNAPSHOT_ENDPOINT = "/.netlify/functions/snapshot";
export const SYNC_ENDPOINT = "/.netlify/functions/sync";
export const DEV_REFRESH_ENDPOINT = "/api/refresh-snapshot";
export const HEALTH_ENDPOINT = "/.netlify/functions/health";
export const STALE_AFTER_MINUTES = 15;
